var mongoose = require('mongoose');

// schema
var photoSchema = mongoose.Schema({
  originalFileName:{type:String},
  serverFileName:{type:String},
  size:{type:Number},
  createdAt:{type:Date, default:Date.now}
});

// model methods
Photo.createNewInstance = async function(file, createdAt){
  return await Photo.create({
      originalFileName:file.originalname,
      serverFileName:file.filename,
      size:file.size,
      createdAt:createdAt
    });
};

// model & export
var Photo = mongoose.model('post', postSchema);
module.exports = Photo;
