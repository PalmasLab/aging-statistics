var custom_date = require("date-format-lite");
var EventEmitter = require('events');
util = require('util');
  

function KeyDispatcher(options){
	EventEmitter.call(this);

	var  options = options || {
		timeInterval : 3000
	}
	var now = new Date() 

	this.last = now
	this.lastMillisecs = now.getTime()
	this.date = now.format('YYYY-MM-DD/hh:00')
	
	this.interval = setInterval(() => {
		var now = new Date() 
		var oldDate = this.date
		var currentDateMillisecs = now.getTime()

		this.last = now;
		this.date = now.format('YYYY-MM-DD/hh:00')

		this.emit('changed', {oldDate: oldDate, currentDate: this.date, currentDateMillisecs: currentDateMillisecs, lastMillisecs: this.lastMillisecs});

		this.lastMillisecs = now.getTime();

	}, options.timeInterval);

	this.DateFormat = (date) => (new Date(date).format('YYYY-MM-DD/hh:00'))
}

util.inherits(KeyDispatcher, EventEmitter);

module.exports = options => (
	new KeyDispatcher(options)
)

