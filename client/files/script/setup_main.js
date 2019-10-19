// ----------------------------------------------------------------------------
// -- Unit / quantity related measurements and conversions

function degreesToRadians(degrees)
{
	return degrees * Math.PI / 180.0;
}
  
function distanceBetweenCoords(lat1, lon1, lat2, lon2)
{
	var earthRadiusKm = 6371000.0;
  
	var dLat = degreesToRadians(lat2 - lat1);
	var dLon = degreesToRadians(lon2 - lon1);
  
	lat1 = degreesToRadians(lat1);
	lat2 = degreesToRadians(lat2);
  
	var a = Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
			Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0) * Math.cos(lat1) * Math.cos(lat2); 
	var c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));

	return earthRadiusKm * c;
}

var rain_states = [
	"No rain",
	"Light rain",
	"Moderate rain",
	"Heavy rain",
	"Very heavy rain",
	"Extreme rain"
];

function FeetToMeters(ft)       { return ft / 3.28084;       }
function MetersToFeet(m)        { return m * 3.28084;        }
function FahrenheitToCelcius(f) { return (f - 32) * (5 / 9); }
function CelciusToFahrenheit(c) { return c * (9 / 5) + 32;   }
function MphToKph(mph)          { return mph * 1.60934;      }
function KphToMph(kph)          { return kph / 1.60934;      }
function KtToKph(kt)            { return kt * 1.852;         }
function KphToKt(kph)           { return kph / 1.852;        }

// ----------------------------------------------------------------------------
// -- Weather conversion and saving

var units   = {};
var weather = {};

function SaveUnits()
{
	units = {
		altitude:       $("#step_units_altitude").val(),
		aircraft_speed: $("#step_units_aircraft_speed").val(),
		wind_speed:     $("#step_units_wind_speed").val(),
		temperature:    $("#step_units_temperature").val()
	};

	SaveData("units", { units: units });
}

function SaveWeather()
{
	weather = {
		temperature_acceptable:     parseInt($("#steps_weather_temperature_acceptable").val()),
		temperature_ideal:          parseInt($("#steps_weather_temperature_ideal").val()),
		rain_level_acceptable:      parseInt($("#steps_weather_rain_level_acceptable").val()),
		rain_level_ideal:           parseInt($("#steps_weather_rain_level_ideal").val()),
		rain_allow_freezing:        $("#steps_weather_rain_allow_freezing")[0].checked,
		rain_allow_snow:            $("#steps_weather_rain_allow_snow")[0].checked,
		rain_allow_hail:            $("#steps_weather_rain_allow_hail")[0].checked,
		cloudbase_acceptable:       parseInt($("#steps_weather_cloudbase_acceptable").val()),
		cloudbase_ideal:            parseInt($("#steps_weather_cloudbase_ideal").val()),
		cloudbase_coverage_percent: parseInt($("#steps_weather_cloudbase_coverage_percent").val()),
		wind_acceptable:            parseInt($("#steps_weather_wind_acceptable").val()),
		wind_ideal:                 parseInt($("#steps_weather_wind_ideal").val()),
		gust_acceptable:            parseInt($("#steps_weather_gust_acceptable").val()),
		gust_ideal:                 parseInt($("#steps_weather_gust_ideal").val()),
		crosswind_acceptable:       parseInt($("#steps_weather_crosswind_acceptable").val()),
		crosswind_ideal:            parseInt($("#steps_weather_crosswind_ideal").val())
	};

	var convertedWeather = JSON.parse(JSON.stringify(weather));

	// Always store everything in meters, km/h, celcius
	if (units.altitude == "ft")
	{
		convertedWeather.cloudbase_acceptable = FeetToMeters(convertedWeather.cloudbase_acceptable);
		convertedWeather.cloudbase_ideal      = FeetToMeters(convertedWeather.cloudbase_ideal);
	}
	
	if (units.temperature == "f")
	{ 
		convertedWeather.temperature_acceptable = FahrenheitToCelcius(convertedWeather.temperature_acceptable);
		convertedWeather.temperature_ideal      = FahrenheitToCelcius(convertedWeather.temperature_ideal);
	}

	if (units.wind_speed == "kt")
	{
		convertedWeather.wind_acceptable      = KtToKph(convertedWeather.wind_acceptable);
		convertedWeather.wind_ideal           = KtToKph(convertedWeather.wind_ideal);
		convertedWeather.gust_acceptable      = KtToKph(convertedWeather.gust_acceptable);
		convertedWeather.gust_ideal           = KtToKph(convertedWeather.gust_ideal);
		convertedWeather.crosswind_acceptable = KtToKph(convertedWeather.crosswind_acceptable);
		convertedWeather.crosswind_ideal      = KtToKph(convertedWeather.crosswind_ideal);
	}

	if (units.wind_speed == "mph")
	{
		convertedWeather.wind_acceptable      = MphToKph(convertedWeather.wind_acceptable);
		convertedWeather.wind_ideal           = MphToKph(convertedWeather.wind_ideal);
		convertedWeather.gust_acceptable      = MphToKph(convertedWeather.gust_acceptable);
		convertedWeather.gust_ideal           = MphToKph(convertedWeather.gust_ideal);
		convertedWeather.crosswind_acceptable = MphToKph(convertedWeather.crosswind_acceptable);
		convertedWeather.crosswind_ideal      = MphToKph(convertedWeather.crosswind_ideal);
	}

	SaveData("weather", { weather: convertedWeather });
}

// ----------------------------------------------------------------------------

function SaveData(what, content) {
	$.post("/setup/save/" + what, content);
}

function PrevStep() { ChangeStep(stepId, stepId - 1); }
function NextStep() { ChangeStep(stepId, stepId + 1); }

function Finish() {
	$.post("/setup/finish", function(data) {
		window.location.href = "/";
	});
}

function ChangeStep(cur, next)
{
	if (next < 0)
		next = 0;

	if (next >= steps.length)
		next = steps.length - 1;

	if (cur == next)
		return;

	if (cur != -1)
	{
		$("#step_" + steps[stepId]).css("visibility", "hidden");
		$("#step_" + steps[stepId]).css("height", "0px");
	}
	stepId = next;

	$.get("/setup/step_" + steps[stepId] + ".html", function(data) {
		$("#step_" + steps[stepId]).html(data);

		StepCallbacks[steps[stepId]](function() {
			$("#step_" + steps[stepId]).css("visibility", "visible");
			$("#step_" + steps[stepId]).css("height", "");
			$(window).scrollTop(0);
		});
	});
}

var stepId = 0;

var steps = [
	"location",
	"location_confirm",
	"units",
	"weather",
	"confirm"
];

var StepCallbacks = {
	"location": function(onDone) {
		$.getJSON("/setup/locations", function(data) {
			data.forEach(function(e) {
				var item = '<div class="item" data-value="' + e.lid + '"><span style="font-weight: bold; padding-right: 8px">' + e.lid + '</span><span style="font-style: italic;">' + e.airportname + ', ' + e.town + '</span></div>';
				$(item).appendTo("#locationmenu");
			});

			$(".ui.dropdown").dropdown();
			onDone();
		});
	},

	"location_confirm": function(onDone) {
		$.getJSON("/setup/location/" + $("#Location_LID").val(), function(data) {
			$("#step_" + steps[stepId] + "_airport_name").html(data.lid + ' (' + data.name + ')');
			$("#step_" + steps[stepId] + "_airport_location").html(data.location.city + ', ' + data.location.state + ', ' + data.location.country);
		
			data.runways.forEach(function(runway) {
				$("<h4>Runway " + runway.name + "</h4>").appendTo("#step_" + steps[stepId] + "_runways");
	
				var runwayLength = distanceBetweenCoords(runway.lat_start, runway.lon_start, runway.lat_end, runway.lon_end);
				$("<p>Length: " + (Math.floor(10.0 * runwayLength) / 10.0) + " m</p>").appendTo("#step_" + steps[stepId] + "_runways");
			});

			onDone();
		});
	},

	"units": function(onDone) {
		$(".ui.dropdown").dropdown();
		onDone();
	},

	"weather": function(onDone) {
		$(".unit.temperature").html("&deg;" + units.temperature.toUpperCase());
		$(".unit.windspeed").html(units.wind_speed);
		$(".unit.altitude").html(units.altitude);

		var defaultAcceptableTemp = -10;
		if (units.temperature == "f")
			defaultAcceptableTemp = Math.round(defaultAcceptableTemp * 9 / 5 + 32);
		$("#temperature_acceptable").val(defaultAcceptableTemp);

		var defaultIdealTemp = 10;
		if (units.temperature == "f")
			defaultIdealTemp = Math.round(defaultIdealTemp * 9 / 5 + 32);
		$("#temperature_ideal").val(defaultIdealTemp);

		var defaultAcceptableWind = 30;
		if (units.wind_speed == "mph")
			defaultAcceptableWind = Math.round(defaultAcceptableWind / 1.609344);
		if (units.wind_speed == "kt")
			defaultAcceptableWind = Math.round(defaultAcceptableWind / 1.852);
		$("#wind_acceptable").val(defaultAcceptableWind);

		var defaultIdealWind = 10;
		if (units.wind_speed == "mph")
			defaultIdealWind = Math.round(defaultIdealWind / 1.609344);
		if (units.wind_speed == "kt")
			defaultIdealWind = Math.round(defaultIdealWind / 1.852);
		$("#wind_ideal").val(defaultIdealWind);

		$(".ui.dropdown").dropdown();
		onDone();
	},

	"confirm": function(onDone) {
		$(".unit.temperature").html("&deg;" + units.temperature.toUpperCase());
		$(".unit.windspeed").html(units.wind_speed);
		$(".unit.altitude").html(units.altitude);

		$("#step_confirm_units_altitude").html(units.altitude);
		$("#step_confirm_aircraft_speed").html(units.aircraft_speed);
		$("#step_confirm_wind_speed").html(units.wind_speed);
		$("#step_confirm_units_temperature").html(units.temperature == "c" ? "celcius" : "fahrenheit");

		$("#step_confirm_weather_temperature_ideal").html(weather.temperature_ideal);
		$("#step_confirm_weather_temperature_acceptable").html(weather.temperature_acceptable);
		$("#step_confirm_weather_rain_level_ideal").html(rain_states[weather.rain_level_ideal]);
		$("#step_confirm_weather_rain_level_acceptable").html(rain_states[weather.rain_level_acceptable]);
		$("#step_confirm_weather_rain_allow_freezing").html(weather.rain_allow_freezing ? "OK" : "NOT OK");
		$("#step_confirm_weather_rain_allow_snow").html(weather.rain_allow_snow ? "OK" : "NOT OK");
		$("#step_confirm_weather_rain_allow_hail").html(weather.rain_allow_hail ? "OK" : "NOT OK");
		$("#step_confirm_weather_cloudbase_ideal").html(weather.cloudbase_ideal);
		$("#step_confirm_weather_cloudbase_acceptable").html(weather.cloudbase_acceptable);
		$("#step_confirm_weather_cloudbase_coverage_percent").html(weather.cloudbase_coverage_percent);
		$("#step_confirm_weather_windspeed_ideal").html(weather.wind_ideal);
		$("#step_confirm_weather_windspeed_acceptable").html(weather.wind_acceptable);
		$("#step_confirm_weather_gusts_ideal").html(weather.gust_ideal);
		$("#step_confirm_weather_gusts_acceptable").html(weather.gust_acceptable);
		$("#step_confirm_weather_crosswind_ideal").html(weather.crosswind_ideal);
		$("#step_confirm_weather_crosswind_acceptable").html(weather.crosswind_acceptable);

		$.getJSON("/setup/location/" + $("#Location_LID").val(), function(data) {
			$("#step_confirm_location").html(data.lid + ' (' + data.name + ')');
		
			data.runways.forEach(function(runway) {
				$("<h4>Runway " + runway.name + "</h4>").appendTo("#step_confirm_runways");
	
				var runwayLength = distanceBetweenCoords(runway.lat_start, runway.lon_start, runway.lat_end, runway.lon_end);
				$("<p>Length: " + (Math.floor(10.0 * runwayLength) / 10.0) + " m</p>").appendTo("#step_confirm_runways");
			});

			onDone();
		});
	}
};

// ----------------------------------------------------------------------------
// -- Entry point

$(document).ready(function() {

	console.log("Can I Fly? v0.1.0 - Setup page");
	$("#greeter").addClass("visible");

	steps.forEach(function(step) {
		$('<div class="ui" id="step_' + step + '" style="visibility: hidden;"></div>').appendTo("#main_container");
	});

	setTimeout(function() {
		ChangeStep(-1, 0);

		$("#greeter").removeClass("visible");
		$(".setup.curtain").addClass("hidden");
		
		setTimeout(function() {
			$(".setup.curtain").remove();
			$("#greeter").remove();
		}, 1000);
	}, 2000);
});
