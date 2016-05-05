var express = require('express');
var multilevel = require('multilevel');
var net = require('net');
var level = require('level');
var levelup = require('levelup')
var util = require('util');
var Sublevel = require('level-sublevel')
var KeyDispatcher = require('./keydispatcher');
var path = require('path');
var bodyParser = require('body-parser');

var app = express();
var db = Sublevel(levelup('./db'))
var currentHourVideos = {}

var videosAccount = 5;
var videosInterval = 2; // Including sublevels from 0 

KeyDispatcher().on('changed', tickHandler);

var sublevels= [
		{
			interval: 1000 * 60 * 60,
			first: '00',
			amount: 24,
			sublevel: db.sublevel(1000 * 60 * 60 + '')
		},
		{
			interval: 1000 * 60 * 60 * 24,
			first: '01',
			amount: 30,
			sublevel: db.sublevel(1000 * 60 * 60 * 24 + '')
		},
		{
			interval: 1000 * 60 * 60 * 24 * 30,
			first: '01',
			amount: 12,
			sublevel: db.sublevel(1000 * 60 * 60 * 24 * 30 + '')
		},
		{
			interval: 1000 * 60 * 60 * 24 * 30 * 12,
			first: '01',
			amount: 12,
			sublevel: db.sublevel(1000 * 60 * 60 * 24 * 30 * 12 + '')
		}

	]

var timeChanged = [ 
	(date) => {
		if((new Date(date.currentDateMillisecs).getHours()) != (new Date(date.lastMillisecs).getHours())) {
			return true	
		}
		else return false;
	},
	(date) => {
		if((new Date(date.currentDateMillisecs).getDay()) != (new Date(date.lastMillisecs).getDay())){
			return true;
		}
		else return false;
	},
	(date) => {
		if((new Date(date.currentDateMillisecs).getMonth()) != (new Date(date.lastMillisecs).getMonth())){
			return true	
		}
		else return false;
	},
	(date) => {
		if((new Date(date.currentDateMillisecs).getYear()) != (new Date(date.lastMillisecs).getYear())){
			return true	
		}
		else return false;
	}
] 


app.use(bodyParser.json());                        
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/stats/last', function (req, res) {
	res.send(getMostViewedVideos(videosAccount));

});

app.listen(3000)



function tickHandler(event){
	for(var i=0; i<timeChanged.length; i++){
		if(!timeChanged[i](event)) break;
		updateSublevel(event,i);
	}
}

function  updateSublevel(event,index){
	var videos = {};
	var currentSublevel = sublevels[index].sublevel;

	if(index == 0){
		var videos = currentHourVideos;
		currentHourVideos = {} 

		currentSublevel.createReadStream()
		  .on('data', function (data) {
		  	if(data.key in videos)
		  		videos[data.key] = Number(videos[data.key]) + Number(data.value);
		  	else 
	    		videos[data.key] = Number(data.value);
		})
		  .on('end', function () {
		    Object.keys(videos).map(function(key){
		  		currentSublevel.put(key,videos[key]);	
		  	})
		  })
		  
		  
	} else {
		var previous = sublevels[index - 1];
		var previousSublevel = previous.sublevel;
		var key_to_delete = []

		previousSublevel.createReadStream()
		  .on('data', function (data) {
		  	key_to_delete.push(data.key)
		  	if(data.key in videos)
		    	videos[data.key] = Number(videos[data.key]) + Number(data.value);
		    else 
	    		videos[data.key] = Number(data.value);
		  })
		  .on('end', function () {
		  		currentSublevel.createReadStream()
				  .on('data', function (data) {
				  	if(data.key in videos)
				    	videos[data.key] = Number(videos[data.key]) + Number(data.value);
				    else 
			    		videos[data.key] = Number(data.value);
				  })
				  .on('end', function () {
				  		Object.keys(videos).map(function(key){
						currentSublevel.put(key,videos[key]);	
					})
				  })
				
	    		for(var i=0;i<key_to_delete.length;i++){
					previousSublevel.del(key_to_delete[i])
				}
	  	  })
	}
}

function getMostViewedVideos(response){
	var mostViewed = {};
	var videos = {}
	var sublevels_ended = 0;

	Object.keys(currentHourVideos).map(function(key){
		if(key in videos)
			videos[key] =  Number(currentHourVideos[key]) + Number(videos[key]);
		else
			videos[key] =  Number(currentHourVideos[key])
	})

	for(var a = 0; a < videosInterval; a ++ ){
		sublevels[a].sublevel.createReadStream()
		  	.on('data', function (data) {
		  		if(data.key in videos)
					videos[data.key] =  Number(data.value) + Number(videos[data.key]);
				else
					videos[data.key] =  Number(data.value)
			})
			.on('end', function () {
				sublevels_ended ++;
				
			    if(sublevels_ended == sublevels.length){
				    for(var i=0; i< videosAccount;i++){
						var max = Math.max.apply(null,Object.keys(videos).map(function(key){ return videos[key] }));
						var key = Object.keys(videos).filter(function(key){ return videos[key] == max; })[0];
						
						if(key != undefined && max != -Infinity){
							mostViewed[key] = max;
							delete videos[key];
						}
					}
					response.send( mostViewed)
				}
			})
	}
}


