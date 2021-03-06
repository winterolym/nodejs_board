var mongoose = require('mongoose');

// schema
var boardSchema = mongoose.Schema({
  name:{type:String, required:true, unique:true},
  display:{type:String, required:true}
});

// model & export
var Board = mongoose.model('board', boardSchema);
module.exports = Board;
