function FeetToMeters(ft)       { return ft / 3.28084;       }
function MetersToFeet(m)        { return m * 3.28084;        }
function FahrenheitToCelcius(f) { return (f - 32) * (5 / 9); }
function CelciusToFahrenheit(c) { return c * (9 / 5) + 32;   }
function MphToKph(mph)          { return mph * 1.60934;      }
function KphToMph(kph)          { return kph / 1.60934;      }
function KtToKph(kt)            { return kt * 1.852;         }
function KphToKt(kph)           { return kph / 1.852;        }

function SetVerdictColor(v, vfr) {
	var red   = Math.max(0.0, Math.min(1.0, 2.0 * (1.0-v)));
	var green = v;

	red   = Math.floor(255 * Math.pow(red, 0.75));
	green = Math.floor(255 * green);

	if (vfr > 0)
	{
		$("#verdict_container").css("background-color", "rgb(" + red + ", " + green + ", 0)");
		$("#verdict_container").css("color", "#000");
	}
	else
	{
		$("#verdict_container").css("background-color", "rgb(16, 48, 128)");
		$("#verdict_container").css("color", "#fff");
	}
}

function ComputeVerdict(result)
{
	$("<p style=\"opacity: 0.5;\">Overall comfort score: " + Math.floor(result.verdict * 100) + "%</p>").appendTo("#reasons");

	if (result.verdict == 1.0)
		$("#verdict_container").html("Yes");
	else if (result.verdict == 0.0)
	{
		for(var vid in result.interpretation.scores)
		{
			var val = result.interpretation.scores[vid];

			if (val > 0.0)
				continue;
			
			var reason = "";

			switch(vid)
			{
			case "wind":           reason = "Wind is too strong";              break;
			case "gusts":          reason = "Gusts are too strong";            break;
			case "crosswind":      reason = "Crosswind is too strong";         break;
			case "precipitation":  reason = "It's raining / snowing too much"; break;
			case "temperature":    reason = "It's too cold";                   break;
			case "cloud_coverage": reason = "Cloud coverage prevents flying";  break;
			case "vfrConditions":  reason = "It's night time";                 break;
			}

			$("<p>" + reason + "</p>").appendTo("#reasons");
		}

		$("#verdict_container").html("No");
	}
	else
	{
		for(var vid in result.interpretation.scores)
		{
			var val = result.interpretation.scores[vid];

			if (val == 1.0)
				continue;
			
			var nuance = "";
			if (val > 0.5)
				nuance = "a bit ";

			var reason = "";

			switch(vid)
			{
			case "wind":           reason = "There is " + (val > 0.5 ? "a bit of " : "") + "wind";  break;
			case "gusts":          reason = "It is " + (val > 0.5 ? "a bit " : "") + "gusty";       break;
			case "crosswind":      reason = "There is " + (val > 0.5 ? "some " : "") + "crosswind"; break;
			case "precipitation":  reason = "It's raining / snowing " + (val > 0.5 ? "a bit" : ""); break;
			case "temperature":    reason = "It's " + (val > 0.5 ? "a bit " : "") + "cold";         break;
			case "cloud_coverage": reason = "It's " + (val > 0.5 ? "a bit " : "") + "cloudy";       break;
			case "vfrConditions":  reason = "The sun is setting soon";                              break;
			}

			$("<p>" + reason + "</p>").appendTo("#reasons");
		}

		$("#verdict_container").html('Yes, but...');
	}

	SetVerdictColor(result.verdict, result.interpretation.scores.vfrConditions);
}

function ConvertAllUnits(result)
{
	if (result.units.temperature == "f")
	{
		result.weather.temperature = Math.round(CelciusToFahrenheit(result.weather.temperature));
		result.weather.dew_point   = Math.round(CelciusToFahrenheit(result.weather.dew_point));
	}

	if (result.units.wind_speed == "mph")
	{
		result.weather.wind_speed = Math.round(KphToMph(result.weather.wind_speed));

		if (result.weather.wind_gusts !== undefined)
			result.weather.wind_gusts = Math.round(KphToMph(result.weather.wind_gusts));
	}

	if (result.units.wind_speed == "kt")
	{
		result.weather.wind_speed = Math.round(KphToKt(result.weather.wind_speed));

		if (result.weather.wind_gusts !== undefined)
			result.weather.wind_gusts = Math.round(KphToKt(result.weather.wind_gusts));
	}

	if (result.units.altitude == "ft")
	{
		result.weather.cloud_base = Math.round(MetersToFeet(result.weather.cloud_base) / 100) * 100;
	}
}

function ComputeWeather(result)
{
	ConvertAllUnits(result);
	$('#active_runway').html(result.interpretation.active_runway);

	$("#detail_icon").attr("src", "http://openweathermap.org/img/wn/" + result.weather_icon + "@2x.png");

	$('#temperature_value').html(result.weather.temperature);
	$('.temperature.unit').html(result.units.temperature.toUpperCase());
	$('#dew_point').html(result.weather.dew_point);

	$('#condition_name').html(result.weather.conditions.human_readable);

	$('#cloud_coverage').html(result.weather.cloud_coverage);
	$('#cloud_base_value').html(result.weather.cloud_base);
	$('#cloud_base_unit').html(result.units.altitude);

	$('#humidity').html(result.weather.humidity);

	$('#wind_direction').attr("src", "img/wind_" + result.weather.wind_direction + ".png");
	$('#wind_direction').attr("title", "Wind direction: " + result.weather.wind_direction);
	$('#wind_speed').html(result.weather.wind_speed);
	$('#wind_unit').html(result.units.wind_speed);
	$('#wind_heading').html(result.weather.wind_heading);

	if (result.weather.wind_gusts !== undefined)
		$("#wind_gusts").html("<br />Gusts up to " + result.weather.wind_gusts + " " + result.units.wind_speed);
	else
		$("#wind_gusts").html("");

	var sunrise = new Date(result.daylight.civil_twilight_begin);
	var sunset  = new Date(result.daylight.civil_twilight_end);
	$('#sunrise').html(sunrise.getHours() + ":" + sunrise.getMinutes());
	$('#sunset').html(sunset.getHours() + ":" + sunset.getMinutes());
}

$(document).ready(function() {
	console.log("Can I Fly? v0.1.0");

	$.get("/request", function(data) {
		$("#reasons").html("");

		$('#location').html(data.result.location.lid + " (" + data.result.location.location.city + ", " + data.result.location.location.state + ", " + data.result.location.location.country + ")");

		ComputeVerdict(data.result);
		ComputeWeather(data.result);

		setTimeout(() => {
			$("#data_container").css("visibility", "visible");
			$("#loader").remove();
		}, 500);
		
	});
});