/**
 * Created by jonfor on 9/29/15.
 */
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var sqlite3 = require('sqlite3').verbose();
var gcm = require('node-gcm');
var request = require('request');

app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));

var server = app.listen(8001, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Listening at http://%s:%s', host, port);
});

var dbFile = 'test.db';
var db = new sqlite3.Database(dbFile, sqlite3.OPEN_READWRITE, function (err) {
    if (err) throw err;
    console.log("Opened database %s successfully", dbFile);
});

app.get('/registration/:token', function (req, res, next) {
    db.serialize(function () {

        /* Return a message if the token is already in the database.
         * Otherwise, insert all the data into the database. */
        db.get("SELECT rowid AS id, token FROM users", function (err, row) {
            if (err) throw err;
            if (row && (row.token === req.params.token)) {
                res.send("Registration token already exists in database.");
                db.all("SELECT rowid AS id, token FROM Users", function (err, rows) {
                    if (err) throw err;
                    console.log(rows);
                });
            } else {
                next();
            }
        });
    });
}, function (req, res, next) {
    db.serialize(function () {
        console.log("Token: " + req.params.token);

        var stmtUsers = db.prepare("INSERT INTO users VALUES (?)");
        stmtUsers.run(req.params.token, [], function (err) {
            if (err) throw err;

            stmtUsers.finalize();
            db.all("SELECT rowid AS id, token FROM users", function (err, rows) {
                if (err) throw err;
                console.log("TOKENS" + JSON.stringify(rows));
            });
        });

        res.send("Inserted new token into database.");
    });
});

app.post('/data', function (req, res, next) {
    var frequency = req.body.frequency,
        ip = req.body.ip,
        port = req.body.port,
        token = req.body.token;
    db.serialize(function () {
        var stmtFrequencies = db.prepare("INSERT INTO frequencies (frequency) VALUES($frequency)");
        stmtFrequencies.run(
            {
                $frequency: frequency
            }, function (err) {
                if (err) throw err;
                stmtFrequencies.finalize();
                //db.all("SELECT rowid AS id, frequency FROM frequencies", function (err, rows) {
                //    if (err) throw err;
                //    console.log("FREQUENCIES: " + JSON.stringify(rows));
                //});
            });

        var stmtServers = db.prepare("INSERT INTO servers (ip, port) VALUES($ip, $port)");
        stmtServers.run(
            {
                $ip: ip,
                $port: port
            }, function (err) {
                if (err) throw err;

                stmtServers.finalize();
                //db.all("SELECT rowid AS id, ip FROM servers", function (err, rows) {
                //    if (err) throw err;
                //    console.log("SERVERS: " + JSON.stringify(rows));
                //});
            });
    });

    res.json({"error": 0});
    makePoke(ip, port, frequency, token);
});

function makePoke(ip, port, frequency, token) {
    console.log("Begin poking!");
    var intervalID = setInterval(function () {
        poke(ip, port);
    }, frequency * 60 * 100);
    //sendMessage(token);
}

/**
 * Send message out to users.
 */
function sendMessage(token) {
    var message = new gcm.Message();
    message.addData('key1', 'msg1');

    // Set up the sender with your API key
    var sender = new gcm.Sender('AIzaSyA6ZKrlTMd8zxu8Tc0t8OXn4wSvNR6RS0E');

    // Now the sender can be used to send messages
    sender.send(message, {registrationIds: token}, function (err, result) {
        if (err) {
            console.log(err);
        } else {
            console.log(result);
        }
    });
    //var stmtToken = db.prepare("SELECT token FROM users WHERE token = ?");
    //stmtToken.get(token, function (err, row) {
    //    if (err) throw err;
    //
    //    stmtToken.finalize(function (err) {
    //        if (err) throw err;
    //    });
    //
    //
    //});
}

var status;
function poke(ip, port) {
    //TODO Make work for HTTPS
    var address = "http://" + ip;

    if (port) {
        address = address + ":" + port.toString();
    }

    request(address, function (error, response, body) {
        if (error) {
            status = error;
        } else if (!response) {
            status = "No response!";
        } else if (response.statusCode >= 300) {
            status = "Server is down!"
        } else {
            status = "Server is up!"
        }

        console.log(status);
    });
}
