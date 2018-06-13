var express = require('express');
var streamifier = require('streamifier');
var azureStorage = require('azure-storage');
const mysql = require('mysql2');
var jsdom = require('jsdom');
var bodyParser = require('body-parser');
var colors = require('hex-to-color-name');
const parseJson = require('json-parse-better-errors');
var request = require('request');

var app = express();

const { JSDOM } = jsdom;
const { window } = new JSDOM();
const { document } = (new JSDOM('')).window;
global.document = document;
var $ = jQuery = require('jquery')(window);
//var conn = require('./db');

app.use(bodyParser.urlencoded({ 
    extended: true,
    limit: '5mb',
    parameterLimit: 100000 
}));
app.use(bodyParser.json({limit: '5mb'}));

var conn = mysql.createConnection({
    host: 'facestylerserver.mysql.database.azure.com',
    user: 'facestyler@facestylerserver',
    password: 'Serverpassword03',
    database: 'facestyler',
    port: 3306,
    ssl: true
});

app.use(function(req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'content-type,x-prototype-version,x-requested-with');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

app.post('/processImage', function(req, response) {
    
    console.log(req.body);
    var image_url = req.body.element.trim();
    console.log("Hi i am called with url: "+image_url);

    processImage(image_url,function(error_result,response_result){
        console.log("The result is ",error_result,response_result);
        if(error_result)
            response.send(JSON.stringify({'error':response_result}));
        else
            response.send(JSON.stringify({'Success':response_result}));
    });

});

app.post('/base64Image', function(req, response) {
    console.log("Hi");
    console.log(req.body);
    var image_base64 = req.body.image;
    var image_name = req.body.image_file_name;
    uploadBlob(image_base64,image_name,function(error_result,response_result){
        if(error_result)
            response.send(JSON.stringify({'error':response_result}));
        else
            response.send(JSON.stringify({'Success':response_result}));
    });

});

app.post('/lipshade', function(req, response) {
    console.log("Hi called for lip shade choise ");
    console.log(req.body);
    var image_url = req.body.image_url.trim();
    var lipshade_selected = req.body.lipshade;
    console.log(image_url,lipshade_selected);
    updateLipshade(image_url,lipshade_selected,function(error_result,response_result){
        if(error_result)
            response.send(JSON.stringify({'error':response_result}));
        else
            response.send(JSON.stringify({'Success':response_result}));
    });
});


function uploadBlob(data_string,image_name,callback){

    var block = data_string.split(";");
    // Get the content type
    var contentType = block[0].split(":")[1];// In this case "image/gif"
    // get the real base64 content of the file
    var realData = block[1].split(",")[1];// In this case "iVBORw0KGg...."

    // Convert to blob

    var blobService = azureStorage.createBlobService('facestyler', 
    '9SOEIrOjTTjyaD1mhPQWoudDWOJG75qOt8nBZhdYm1YctD885pYKDColcMXoukXAyNLiqRLRLP3JyecRqZr2lQ==');

    var buffer = Buffer.from(realData, 'base64');
    var stream = streamifier.createReadStream(buffer);
    blobService.createBlockBlobFromStream('test-container', image_name, stream, buffer.byteLength, function(error, response) {
        if (error) {
            callback('Error',response);
        } 
        else {
            var image_url = "https://facestyler.blob.core.windows.net/test-container/"+image_name;
            processImage(image_url,function(error_result,response_result){
                console.log("The result is ",error_result,response_result);
                if(error_result)
                    callback("Error",response_result);
                else
                    callback(null,response_result);
            });
        }
    });
}

var constants = {
    'api_key': 'd45fd466-51e2-4701-8da8-04351c872236',
    'api_secret': '171e8465-f548-401d-b63b-caf0dc28df5f',
    'classifiers':'recognition,propoints,classifiers,extended'
};

function processImage(sourceImageUrl,callback) {
    var headers = {
        'content-type':'application/json',
        'cache-control': 'no-cache'
    };

    // Configure the request
    var options = {
        url: 'https://www.betafaceapi.com/api/v2/media',
        method: 'POST',
        headers: headers,
        body: '{ "api_key": "d45fd466-51e2-4701-8da8-04351c872236","file_uri": "'+sourceImageUrl+'","detection_flags": "basicpoints,propoints,classifiers,extended,content","recognize_targets":["all@mynamespace"],"original_filename":"'+sourceImageUrl+'"}'
    };

    request(options, function (error, response, body) {
        if (error) {
            callback("Error",error);
        }
        else{
            //will call a function
            jsonvalidate(body,function(error_result,response_result){
                if(error_result)
                    callback("Error",response_result);
                else
                    callback(null,response_result);
            });
            console.log(body);
        }
    });
}

function jsonvalidate(data_response,callback){
   
    var data = parseJson(data_response);
    console.log(data);

    var attributes = ['age','arched eyebrows','attractive','bags under eyes','bangs','big lips',
    'big nose','black hair','blond hair','blurry','brown hair','bushy eyebrows','chubby','double chin',
    'gender','glasses','gray hair','heavy makeup','high cheekbones','narrow eyes','oval face',
    'pale skin','pointy nose','race','rosy cheeks','sideburns','straight hair','wavy hair','wearing lipstick'
    ,'young','chin size','color eyes','color hair','color skin','eyebrows position',
    'eyebrows size','eyes corners','eyes distance','eyes position','eyes shape','hair color type','hair length'
    ,'hair sides','nose shape','nose width','faceid','url'];

    
    var object_keys = [];
    var object_values = [];

    //if image not found
    if(data.error_code == -5){
        callback("Error",data.error_description);
    }
    else if(data.media.faces !== null){
        var attri_len = data.media.faces[0].tags.length;
        console.log(attri_len);

        for(var i=0;i<attri_len;i++){
            object_keys.push(data.media.faces[0].tags[i].name);
            object_values.push(data.media.faces[0].tags[i].value);
        }

        object_keys.push('faceid');
        object_values.push(data.media.media_uuid);
        object_keys.push('url');
        object_values.push(data.media.original_filename);


        var db = [];
            //db.push(data.media.faces.length)  for validation

        for(var i=0;i<attributes.length;i++){
        if(object_keys.indexOf(attributes[i]) == -1){
            //not found
            console.log(attributes[i]+" not found");
            db.push("null");
        }
        else{
            //lets check for color also
                if(attributes[i] == 'color eyes'||attributes[i] == 'color hair'|| attributes[i] =='color skin' )
                    db.push(colors(object_values[object_keys.indexOf(attributes[i])]));
            else
                    db.push(object_values[object_keys.indexOf(attributes[i])])
        }
        }
        
        console.log(db);
        console.log(db.length);

        if (db[14]== 'male' || data.media.faces.length > 1) 
            callback("Error","Please upload a photo which contains single female only !"); 
        else if(data.media.tags[0].value == "yes")
            callback("Error","This Photo contains Adult Content, Please Upload a new one !");
        else{
            console.log("Upload image successful --> go to db");
            //call upload function
            uploads(db,function(error_result,response_result){
                if(error_result)
                    callback("Error",response_result);
                else
                    callback(null,response_result);
            });
        }
    }
    else
        callback("Error","Sorry We are not able to Identify a face from this Image. Please Upload a new Image !"); 
}

function uploads(data,callback){
    //now lets start inserting data into db
    var quotedIds_first = data.map(function(id) { return "'" + id + "'"; }).join(", ");
    var insert_query_users = "INSERT INTO users VALUES ("+quotedIds_first+",'')";
    console.log(insert_query_users);

    queryAddUsersAttri(insert_query_users,function(error_result,response_result){
        if(error_result){
            callback("Error",response_result);
        }
        else{
            callback(null,data[47]);
        }
    });
}

function queryAddUsersAttri(query_add_user,callback){
    conn.connect();
    console.log("Hi i am called querry with queries : ");
    conn.query(query_add_user, function (err, results, fields) { 
        if (err){
            callback("Error",err.sqlMessage);
        }
        else{
            callback(null,null);
        }
    });
}

function updateLipshade(image_url,lipshade_selected,callback){
    conn.connect();
    console.log("Hi i am called querry with queries : ");
    var query_update_lipshade = "UPDATE users SET LipShade = '"+lipshade_selected+"' WHERE Url = '"+image_url+"' ";
    console.log(query_update_lipshade);
    conn.query(query_update_lipshade, function (err, results, fields) { 
        if (err){
            callback("Error",err.sqlMessage);
        }
        else{
            callback(null,null);
        }
    });
}

function serviceUri()
{
    return (window.location.protocol != "https:")?"http://www.betafaceapi.com/service.svc":"https://www.betafaceapi.com/service_ssl.svc";
}

var port = process.env.port || 1337;
var server = app.listen(port, function (req,res,next) {
    console.log("App listening at %s", port)
});

//table query
// CREATE TABLE IF NOT EXISTS `facestyler`.`Users` ( `Age` TINYINT UNSIGNED NOT  NULL, 
// `ArchedEyebrows` VARCHAR(20) NOT  NULL ,`Attractive` VARCHAR(20) NOT NULL, `BagsUnderEyes` 
// VARCHAR(20) NOT NULL , `Bangs` VARCHAR(20) NOT NULL , `BigLips`
// VARCHAR(20) NOT NULL , `BigNose` VARCHAR(20) NOT NULL , `BlackHair` VARCHAR(20) NOT NULL , 
// `BlondHair` VARCHAR(20) NOT NULL ,`Blurry` VARCHAR(20) NOT NULL , `BrownHair` VARCHAR(20) 
// NOT NULL , `BushyEyebrows` VARCHAR(20) NOT NULL , `Chubby` VARCHAR(20) NOT NULL , `DoubleChin`
// VARCHAR(20) NOT NULL , `Gender` VARCHAR(20) NOT NULL ,`Glasses` VARCHAR(20) NOT NULL , 
// `Gray hair` VARCHAR(20) NOT NULL , `HeavyMakeup` VARCHAR(20) NOT NULL , `HighCheekbones` 
// VARCHAR(20) NOT NULL , `NarrowEyes` VARCHAR(20) NOT NULL , `OvalFace` VARCHAR(20) NOT NULL , 
// `PaleSkin` VARCHAR(20) NOT NULL , `PointyNose` VARCHAR(20) NOT NULL, `Race` VARCHAR(20) NOT NULL , 
// `RosyCheeks` VARCHAR(20) NOT NULL , `Sideburns` VARCHAR(20) NOT NULL , `StraightHair` VARCHAR(20) 
// NOT NULL , `WavyHair` VARCHAR(20) NOT NULL , `WearingLipstick` VARCHAR(20) NOT NULL ,`Young`
// VARCHAR(20) NOT NULL ,`ChinSize` VARCHAR(20) NOT NULL ,`ColorEyes` VARCHAR(100) NOT NULL ,`ColorHair` 
// VARCHAR(100) NOT NULL ,`ColorSkin` VARCHAR(100) NOT NULL , NOT NULL ,`EyebrowsPosition` VARCHAR(20) 
// NOT NULL ,`EyebrowsSize` VARCHAR(20) NOT NULL ,`EyesCorners` VARCHAR(20) NOT NULL ,`EyesDistance` 
// VARCHAR(20) NOT NULL ,`EyesPosition`VARCHAR(20) NOT NULL ,`EyesShape` VARCHAR(20) NOT NULL ,
// `HairColorType` VARCHAR(20) NOT NULL, `HairLength` VARCHAR(20) NOT NULL ,`HairSides` VARCHAR(20) 
// NOT NULL ,`NoseShape` VARCHAR(20) NOT NULL ,`NoseWidth` VARCHAR(20) NOT NULL , `FaceID` VARCHAR(255) 
// NOT  NULL ,`Url` VARCHAR(255) NOT  NULL , `LipShade` VARCHAR(255) NULL , PRIMARY KEY (`FaceID`)) 
// ENGINE = InnoDB COMMENT = 'Table Made to Store Users Attribute data after betaface Api Call';

//tabel structure

// +------------------+---------------------+------+-----+---------+-------+
// | Field            | Type                | Null | Key | Default | Extra |
// +------------------+---------------------+------+-----+---------+-------+
// | Age              | tinyint(3) unsigned | NO   |     | NULL    |       |
// | ArchedEyebrows   | varchar(20)         | NO   |     | NULL    |       |
// | Attractive       | varchar(20)         | NO   |     | NULL    |       |
// | BagsUnderEyes    | varchar(20)         | NO   |     | NULL    |       |
// | Bangs            | varchar(20)         | NO   |     | NULL    |       |
// | BigLips          | varchar(20)         | NO   |     | NULL    |       |
// | BigNose          | varchar(20)         | NO   |     | NULL    |       |
// | BlackHair        | varchar(20)         | NO   |     | NULL    |       |
// | BlondHair        | varchar(20)         | NO   |     | NULL    |       |
// | Blurry           | varchar(20)         | NO   |     | NULL    |       |
// | BrownHair        | varchar(20)         | NO   |     | NULL    |       |
// | BushyEyebrows    | varchar(20)         | NO   |     | NULL    |       |
// | Chubby           | varchar(20)         | NO   |     | NULL    |       |
// | DoubleChin       | varchar(20)         | NO   |     | NULL    |       |
// | Gender           | varchar(20)         | NO   |     | NULL    |       |
// | Glasses          | varchar(20)         | NO   |     | NULL    |       |
// | Gray hair        | varchar(20)         | NO   |     | NULL    |       |
// | HeavyMakeup      | varchar(20)         | NO   |     | NULL    |       |
// | HighCheekbones   | varchar(20)         | NO   |     | NULL    |       |
// | NarrowEyes       | varchar(20)         | NO   |     | NULL    |       |
// | OvalFace         | varchar(20)         | NO   |     | NULL    |       |
// | PaleSkin         | varchar(20)         | NO   |     | NULL    |       |
// | PointyNose       | varchar(20)         | NO   |     | NULL    |       |
// | Race             | varchar(20)         | NO   |     | NULL    |       |
// | RosyCheeks       | varchar(20)         | NO   |     | NULL    |       |
// | Sideburns        | varchar(20)         | NO   |     | NULL    |       |
// | StraightHair     | varchar(20)         | NO   |     | NULL    |       |
// | WavyHair         | varchar(20)         | NO   |     | NULL    |       |
// | WearingLipstick  | varchar(20)         | NO   |     | NULL    |       |
// | Young            | varchar(20)         | NO   |     | NULL    |       |
// | ChinSize         | varchar(20)         | NO   |     | NULL    |       |
// | ColorEyes        | varchar(100)        | NO   |     | NULL    |       |
// | ColorHair        | varchar(100)        | NO   |     | NULL    |       |
// | ColorSkin        | varchar(100)        | NO   |     | NULL    |       |
// | EyebrowsPosition | varchar(20)         | NO   |     | NULL    |       |
// | EyebrowsSize     | varchar(20)         | NO   |     | NULL    |       |
// | EyesCorners      | varchar(20)         | NO   |     | NULL    |       |
// | EyesDistance     | varchar(20)         | NO   |     | NULL    |       |
// | EyesPosition     | varchar(20)         | NO   |     | NULL    |       |
// | EyesShape        | varchar(20)         | NO   |     | NULL    |       |
// | HairColorType    | varchar(20)         | NO   |     | NULL    |       |
// | HairLength       | varchar(20)         | NO   |     | NULL    |       |
// | HairSides        | varchar(20)         | NO   |     | NULL    |       |
// | NoseShape        | varchar(20)         | NO   |     | NULL    |       |
// | NoseWidth        | varchar(20)         | NO   |     | NULL    |       |
// | FaceID           | varchar(255)        | NO   | PRI | NULL    |       |
// | Url              | varchar(255)        | NO   |     | NULL    |       |
// | LipShade         | varchar(255)        | YES  |     | NULL    |       |
// +------------------+---------------------+------+-----+---------+-------+
// 48 rows in set (0.32 sec)