var express    = require("express");
var bodyParser = require("body-parser");

var path       = require("path");
var fs         = require("fs");
var csv        = require("csv-parser");

var https      = require('https');

const OPENWEATHERMAP_APPID = "17021f378a5620c8b212746f89c5ba51";

// ----------------------------------------------------------------------------

var airports = [];
var airportDetails = require('./data/airport_details.json');

for(var aptLid in airportDetails)
{
	var airport = airportDetails[aptLid];

	if (airport.location.city === undefined || airport.lid === undefined || airport.name === undefined)
		continue;

	var apt = {
		town:        airport.location.city,
		state:       airport.location.state,
		country:     airport.location.country,
		airportname: airport.name,
		lid:         airport.lid,
		lat:         airport.location.latitude,
		lon:         airport.location.longitude
	};

	airports.push(apt);
}

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('client/files'));

// ----------------------------------------------------------------------------
// -- Setup routes

var settings = {};
var lastStep = "location";

function ProcessOneTimeSetup()
{
	console.log("Reading initial data...");
	ReadCurrentWeather(
		()    => { console.log("    Initial weather readout OK"); },
		(err) => { console.log("    Initial weather readout failed: " + err); }
	);

	ReadForecast(
		()    => { console.log("    Initial forecast readout OK"); },
		(err) => { console.log("    Initial forecast readout failed: " + err); }
	);

	console.log("Setting up update loop...");

	setInterval(() => {
		ReadCurrentWeather(
			()    => { console.log("Weather readout OK"); },
			(err) => { console.log("Weather readout failed: " + err); }
		);

		ReadForecast(
			()    => { console.log("Forecast readout OK"); },
			(err) => { console.log("Forecast readout failed: " + err); }
		);
	}, requestTTL);
}

app.get("/setup", function(req, res) {
	if (lastStep == "done")
		res.redirect("/");
	else
		res.sendFile(path.join(__dirname + '/client/setup.html'));
});

app.get("/setup/locations", function(req, res) {
	res.send(airports);
});

app.get("/setup/locations/:s", function(req, res) {
	var result = [];

	airports.forEach(function(item) {
		if (item.lid.toLowerCase().includes(req.params.s.toLowerCase()) || item.town.toLowerCase().includes(req.params.s.toLowerCase()) || item.airportname.toLowerCase().includes(req.params.s.toLowerCase()))
			result.push(item);
	});

	res.send({ results: result });
});

app.get("/setup/location/:s", function(req, res) {
	if (airportDetails[req.params.s] === undefined)
	{
		res.status(404).send({ error: "Location not found" });
		return;
	}

	res.send(airportDetails[req.params.s]);
});

// ----------------------------------------------------------------------------
// -- Setup data routes

app.post("/setup/save/:what", function(req, res) {
	switch(req.params.what)
	{
	case "location": settings.airport_lid = req.body.lid;     break;
	case "units":    settings.units       = req.body.units;   break;
	case "weather":  settings.weather     = req.body.weather; break;
	default: res.status(404).send({ result: "SETTING_ID_UNKNOWN" }); return;
	}
	
	res.send({ result: "OK" });
});

app.post("/setup/finish", function(req, res) {
	console.log("Setup finished.");
	console.log(settings);
	console.log("");
	console.log("Writing settings to disk...");

	fs.writeFileSync(path.join(__dirname + '/settings.json'), JSON.stringify(settings));
	console.log("...Done.");

	ProcessOneTimeSetup();

	res.send({ result: "OK" });
});

app.post("/setup/reset", function(req, res) {
	// TODO: Ask for a password, save it, then check for parameter to authorize settings.json deletion

	res.status(403).send({ result: "ACCESS_FORBIDDEN" });
});

// ----------------------------------------------------------------------------
// -- Weather decoding

const WEATHER_CODES = {
	200: "Thunderstorm with light rain",
	201: "Thunderstorm with rain",
	202: "Thunderstorm with heavy rain",
	210: "Light thunderstorm",
	211: "Thunderstorm",
	212: "Heavy thunderstorm",
	221: "Ragged thunderstorm",
	230: "Thunderstorm with light drizzle",
	231: "Thunderstorm with drizzle",
	232: "Thunderstorm with heavy drizzle",
	300: "Light intensity drizzle",
	301: "Drizzle",
	302: "Heavy intensity drizzle",
	310: "Light intensity drizzle rain",
	311: "Drizzle rain",
	312: "Heavy intensity drizzle rain",
	313: "Shower rain and drizzle",
	314: "Heavy shower rain and drizzle",
	321: "Shower drizzle",
	500: "Light rain",
	501: "Moderate rain",
	502: "Heavy intensity rain",
	503: "Very heavy rain",
	504: "Extreme rain",
	511: "Freezing rain",
	520: "Light intensity shower rain",
	521: "Shower rain",
	522: "Heavy intensity shower rain",
	531: "Ragged shower rain",
	600: "Light snow",
	601: "Snow",
	602: "Heavy snow",
	611: "Sleet",
	612: "Light shower sleet",
	613: "Shower sleet",
	615: "Light rain and snow",
	616: "Rain and snow",
	620: "Light shower snow",
	621: "Shower snow",
	622: "Heavy shower snow",
	701: "Mist",
	711: "Smoke",
	721: "Haze",
	731: "Sand / dust whirls",
	741: "Fog",
	751: "Sand",
	761: "Dust",
	762: "Volcanic ash",
	771: "Squalls",
	781: "Tornado",
	800: "Clear sky",
	801: "Few clouds (11-25%)",
	802: "Scattered clouds (25-50%)",
	803: "Broken clouds (51-84%)",
	804: "Overcast clouds (85-100%)"
};

const WIND_DIRECTIONS = {
	"N"  :   0.0 * Math.PI / 180.0,
	"NNE":  22.5 * Math.PI / 180.0,
	"NE" :  45.0 * Math.PI / 180.0,
	"ENE":  67.5 * Math.PI / 180.0,
	"E"  :  90.0 * Math.PI / 180.0,
	"ESE": 112.5 * Math.PI / 180.0,
	"SE" : 135.0 * Math.PI / 180.0,
	"SSE": 157.5 * Math.PI / 180.0,
	"S"  : 180.0 * Math.PI / 180.0,
	"SSW": 202.5 * Math.PI / 180.0,
	"SW" : 225.0 * Math.PI / 180.0,
	"WSW": 247.5 * Math.PI / 180.0,
	"W"  : 270.0 * Math.PI / 180.0,
	"WNW": 292.5 * Math.PI / 180.0,
	"NW" : 315.0 * Math.PI / 180.0,
	"NNW": 337.5 * Math.PI / 180.0,
};

function FeetToMeters(ft)       { return ft / 3.28084;       }
function MetersToFeet(m)        { return m * 3.28084;        }
function FahrenheitToCelcius(f) { return (f - 32) * (5 / 9); }
function CelciusToFahrenheit(c) { return c * (9 / 5) + 32;   }
function MphToKph(mph)          { return mph * 1.60934;      }
function KphToMph(kph)          { return kph / 1.60934;      }
function KtToKph(kt)            { return kt * 1.852;         }
function KphToKt(kph)           { return kph / 1.852;        }

function HeadingToDirection(speed, hdg)
{
	var direction = "No significant wind";

	if (speed > 1.0)
	{
		var minDiff    = 720.0;
		var headingRad = hdg * Math.PI / 180.0;
		for(var dir in WIND_DIRECTIONS)
		{
			var h = headingRad;
			if (WIND_DIRECTIONS[dir] > Math.PI && h < Math.PI)
				h += Math.PI * 2.0;
			if (WIND_DIRECTIONS[dir] < Math.PI && h > Math.PI)
				h -= Math.PI * 2.0;

			var diff = Math.abs(h - WIND_DIRECTIONS[dir]);

			if (diff < minDiff)
			{
				minDiff    = diff;
				direction = dir;
			}
		}
	}

	return direction;
}

function ComputeDewPoint(t, rh)
{
	var a = 17.27;
	var b = 237.7;

	var aTRH = (a * t) / (b + t) + Math.log(rh * 0.01);
	return (b * aTRH) / (a - aTRH);
};

function ComputeCloudBase(temperature, dewPoint)
{
	var spread = temperature - dewPoint;
	return FeetToMeters((spread / 2.5) * 1000.0);
}

function DecodeWeather(currentData)
{
	var result = {};
	result["temperature"]    = Math.floor(currentData.main.temp - 273.15);
	result["pressure"]       = currentData.main.pressure;
	result["humidity"]       = currentData.main.humidity;
	result["dew_point"]      = Math.floor(ComputeDewPoint(result["temperature"], result["humidity"]));
	result["cloud_coverage"] = currentData.clouds.all;
	result["cloud_base"]     = Math.floor(ComputeCloudBase(result["temperature"], result["dew_point"]) / 100.0) * 100.0;
	result["conditions"]     = {
		"code":           currentData.weather[0].id,
		"human_readable": WEATHER_CODES[currentData.weather[0].id]
	}
	result["wind_speed"]     = Math.round(currentData.wind.speed * 3.6);

	if (currentData.wind.gust !== undefined)
		result["wind_gusts"] = Math.round(currentData.wind.gust * 3.6);

	if (currentData.wind.deg !== undefined)
		result["wind_heading"] = currentData.wind.deg;

	result["wind_direction"] = HeadingToDirection(result.wind_speed, result.wind_heading);

	return result;
}

function GetActiveRunway(windHeading) {
	var activeRunwayName = "";
	var minAngle = 10000;

	var apt = airportDetails[settings.airport_lid];

	apt.runways.forEach(function(rwy) {
		var runwayHeading = parseInt(rwy.name) * 10;

		var dHeading = Math.abs(runwayHeading - windHeading);
		if (dHeading > 180)
			dHeading = Math.abs(dHeading - 360);

		if (dHeading < minAngle)
		{
			minAngle = dHeading;
			activeRunwayName = rwy.name;
		}
	});

	return activeRunwayName;
}

function IsCrosswind(heading) {
	var apt = airportDetails[settings.airport_lid];

	var activeRunwayHeading = parseInt(GetActiveRunway(heading)) * 10;

	var dHeading = Math.abs(activeRunwayHeading - heading);
	if (dHeading > 180)
		dHeading = Math.abs(dHeading - 360);

	if (dHeading > 45)
		return true;

	return false;
}

function InterpretWeather(weather) {
	var result = {};

	{ // Precipitation
		var type  = Math.floor(weather.condition_code / 10) * 10;
		var state = weather.condition_code % 10;

		var precipitation_result = 1.0;

		var interpretRain = function(intensity) {
			if (intensity <= settings.weather.rain_level_ideal)
				return 1.0;

			if (intensity > settings.weather.rain_level_acceptable)
				return 0.0;

			var result = (intensity - settings.weather.rain_level_ideal) / (settings.weather.rain_level_ideal - settings.weather.rain_level_ideal);
			return Math.max(0.0, Math.min(1.0, result));
		};

		switch(type)
		{
		case 200: // Thunderstorm
		case 210:
		case 220:
		case 230:
		case 730: // Sand/dust whirls
		case 750: // Sand storm
		case 760: // Dust storm, volcanic ash
		case 770: // Squalls
		case 780: // Tornado
			precipitation_result = 0.0;
			break;

		case 300: // Drizzle
		case 310:
		case 320:
		case 500: // Rain
		case 520:
		case 530:
			precipitation_result = interpretRain(state + 1);
			break;

		case 511: // Freezing rain
			if (settings.weather.rain_allow_freezing)
				precipitation_result = interpretRain(state + 1);
			else
				precipitation_result = 0.0;
			break;
		
		case 600: // Snow
		case 610:
		case 620:
			if (settings.weather.rain_allow_snow)
				precipitation_result = interpretRain(state + 1);
			else
				precipitation_result = 0.0;
			break;
		}

		result["precipitation"] = precipitation_result;
	}

	{ // Wind
		var baseWind = 1.0 - ((weather.wind_speed - settings.weather.wind_ideal) / (settings.weather.wind_acceptable - settings.weather.wind_ideal));

		var gustWind = 1.0;
		if (weather.wind_gusts !== undefined)
			gustWind = 1.0 - ((weather.wind_gusts - settings.weather.gust_ideal) / (settings.weather.gust_acceptable - settings.weather.gust_ideal));

		var crossWind = 1.0;

		if (IsCrosswind(weather.wind_heading))
		{
			var crossBase = 1.0 - ((weather.wind_speed - settings.weather.crosswind_ideal) / (settings.weather.crosswind_acceptable - settings.weather.crosswind_ideal));
			var crossGust = 1.0;
			
			if (weather.wind_gusts !== undefined)
				crossGust = 1.0 - ((weather.wind_gusts - settings.weather.crosswind_ideal) / (settings.weather.crosswind_acceptable - settings.weather.crosswind_ideal));

			crossWind = Math.min(crossBase, crossGust);
		}
		
		result["wind"] = Math.max(0.0, Math.min(1.0, baseWind));
		result["gusts"] = Math.max(0.0, Math.min(1.0, gustWind));
		result["crosswind"] = Math.max(0.0, Math.min(1.0, crossWind));
	}

	{ // Cloud coverage
		result["cloud_coverage"] = 1.0;

		if (weather.cloud_coverage >= settings.weather.cloud_coverage)
		{
			var cc_result = (weather.cloud_base - settings.weather.cloudbase_acceptable) / (settings.weather.cloudbase_ideal - settings.weather.cloudbase_acceptable);
			result["cloud_base"] = Math.max(0.0, Math.min(1.0, cc_result));
		}
	}

	{ // Temperature
		var temp_result = (weather.temperature - settings.weather.temperature_acceptable) / (settings.weather.temperature_ideal - settings.weather.temperature_acceptable);
		result["temperature"] = Math.max(0.0, Math.min(1.0, temp_result));
	}

	return {
		active_runway: GetActiveRunway(weather.wind_heading),
		scores:        result
	};
}

// ----------------------------------------------------------------------------

var lastTimestamp  = 0;
var latestCurrent  = {};
var latestForecast = [];

var requestTTL    = (3600 * 1000) / 2; // 30 minutes

function ReadCurrentWeather(onDone, onError)
{
	var apt = airportDetails[settings.airport_lid];

	https.get("https://api.openweathermap.org/data/2.5/weather?lat=" + apt.location.latitude + "&lon=" + apt.location.longitude + "&appid=" + OPENWEATHERMAP_APPID, (resp) => {
		let data = "";

		resp.on("data", (chunk) => { data += chunk; });

		resp.on("end", () => {
			var rawData = JSON.parse(data);
			var decodedWeather = DecodeWeather(rawData);
			var interpretation = InterpretWeather(decodedWeather);

			var verdict = 1.0;

			latestCurrent = {
				weather:        decodedWeather,
				interpretation: interpretation,
			};

			latestCurrent["weather_icon"] = rawData.weather[0].icon;

			latestCurrent["verdict"] = ((() => {
				var minScore = 1.0;

				for(var score in latestCurrent.interpretation.scores)
					minScore = Math.min(minScore, latestCurrent.interpretation.scores[score]);
					
				return minScore;
			})());

			lastTimestamp = Date.now();
			data = "";

			https.get("https://api.sunrise-sunset.org/json?lat=" + apt.location.latitude + "&lng=" + apt.location.longitude + "&formatted=0", (resp) => {
				resp.on("data", (chunk) => { data += chunk; });
				resp.on("end", () => {
					var decodedTimings = JSON.parse(data).results;

					var dateNow   = new Date();
					var vfr_start = new Date(decodedTimings.civil_twilight_begin);
					var vfr_end   = new Date(decodedTimings.civil_twilight_end);
	
					var daylightResult = 1.0;

					if (dateNow < vfr_start || dateNow > vfr_end)
						daylightResult = 0.0;
					else
					{
						var vfrEndMs = vfr_end.getTime();
						var nowMs    = dateNow.getTime();
						var dt       = (vfrEndMs - nowMs) / 60000;

						if (dt < 30) // minutes
							daylightResult = 0.5;
					}
					
					latestCurrent.location                            = apt;
					latestCurrent.daylight                            = decodedTimings;
					latestCurrent.interpretation.scores.vfrConditions = daylightResult;
					latestCurrent.units                               = settings.units;
					latestCurrent.verdict                             = Math.min(latestCurrent.verdict, daylightResult);

					onDone(latestCurrent);
				});
			});
		}).on("error", (err) => {
			lastTimestamp = 0;
			onError("Unable to request daylight values: " + err.message);
		});

	}).on("error", (err) => {
		lastTimestamp = 0;
		onError("Unable to request weather: " + err.message);
	});
}

function FormatForcastDate(date, format)
{
    var z = {
        M: date.getMonth() + 1,
        d: date.getDate(),
        h: date.getHours(),
        m: date.getMinutes(),
        s: date.getSeconds()
	};
	
    format = format.replace(/(M+|d+|h+|m+|s+)/g, function(v) {
        return ((v.length > 1 ? "0" : "") + eval('z.' + v.slice(-1))).slice(-2);
    });

    return format.replace(/(y+)/g, function(v) {
        return date.getFullYear().toString().slice(-v.length);
    });
}

function ReadForecast(onDone, onError)
{
	var apt = airportDetails[settings.airport_lid];

	https.get("https://api.openweathermap.org/data/2.5/forecast?lat=" + apt.location.latitude + "&lon=" + apt.location.longitude + "&appid=" + OPENWEATHERMAP_APPID, (resp) => {
		let data = "";

		resp.on("data", (chunk) => { data += chunk; });

		resp.on("end", () => {
			var rawData = JSON.parse(data);

			var itemCount = rawData.list.length;

			latestForecast = [];
			rawData.list.forEach(function(item) {
				var decodedWeather = DecodeWeather(item);
				var interpretation = InterpretWeather(decodedWeather);

				var verdict = 1.0;

				verdict = ((() => {
					var minScore = 1.0;
	
					for(var score in interpretation.scores)
						minScore = Math.min(minScore, interpretation.scores[score]);
						
					return minScore;
				})());

				// Simplified, less accurate day/night check to be easy on the sunrise-sunset server
				var vfrConditionIconLetter = item.weather[0].icon.charAt(2);
				interpretation.scores.vfrConditions = (vfrConditionIconLetter == "d" ? 1.0 : 0.0);

				verdict = ((() => {
					var minScore = 1.0;
	
					for(var score in interpretation.scores)
						minScore = Math.min(minScore, interpretation.scores[score]);
						
					return minScore;
				})());

				var itemDate = new Date(item.dt * 1000);

				latestForecast.push({
					time:           itemDate.toISOString(),
					weather:        decodedWeather,
					interpretation: interpretation,
					verdict:        Math.min(verdict, interpretation.scores.vfrConditions)
				});
			});

			onDone();
		});
	}).on("error", (err) => {
		lastTimestamp = 0;
		onError("Unable to request forecast: " + err.message);
	});
}

// ----------------------------------------------------------------------------
// -- Main routes

app.get("/current", function(req, res) {
	res.send({ result: latestCurrent });
});

app.get("/forecast", function(req, res) {
	res.send({ result: latestForecast });
});

// ----------------------------------------------------------------------------
// -- Root route (lol)

app.get("/", function(req, res) {
	if (!fs.existsSync(path.join(__dirname + '/settings.json')))
	{
		console.log("No settings, redirecting to setup.");
		res.redirect("/setup");
		return;
	}

	res.sendFile(path.join(__dirname + '/client/index.html'));
});

// ----------------------------------------------------------------------------
// -- Server start

var server = app.listen(3133, function() {
	console.log("CanIFly Server v0.1.0");
	console.log("Listening on port %s...", server.address().port);

	if (fs.existsSync(path.join(__dirname + '/settings.json')))
	{
		settings = JSON.parse(fs.readFileSync(path.join(__dirname + '/settings.json')));
		ProcessOneTimeSetup();
	}
});
