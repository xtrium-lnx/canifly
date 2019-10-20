function FeetToMeters(ft)       { return ft / 3.28084;       }
function MetersToFeet(m)        { return m * 3.28084;        }
function FahrenheitToCelcius(f) { return (f - 32) * (5 / 9); }
function CelciusToFahrenheit(c) { return c * (9 / 5) + 32;   }
function MphToKph(mph)          { return mph * 1.60934;      }
function KphToMph(kph)          { return kph / 1.60934;      }
function KtToKph(kt)            { return kt * 1.852;         }
function KphToKt(kph)           { return kph / 1.852;        }

function ComputeVerdictColor(v, vfr) {
	var red   = Math.max(0.0, Math.min(1.0, 2.0 * (1.0-v)));
	var green = v;

	red   = Math.floor(255 * Math.pow(red, 0.75));
	green = Math.floor(255 * green);

	if (vfr > 0)
		return [ "rgb(" + red + ", " + green + ", 0)", "#000" ];
	else
		return [ "rgb(16, 48, 128)", "#fff" ];
}

function ComputeVerdict(result)
{
	if (result.verdict > 0.01)
		$("<p style=\"opacity: 0.5;\">Overall comfort score: " + Math.floor(result.verdict * 100) + "%</p>").appendTo("#reasons");

	if (result.verdict == 1.0)
		$("#verdict_container").html("Yes");
	else
	{
		if (result.verdict < 0.01)
			$("#verdict_container").html("No");
		else
			$("#verdict_container").html('Yes, but...');

		for(var vid in result.interpretation.scores)
		{
			var val = result.interpretation.scores[vid];

			if (val > 0.01)
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
			
			$("<p class=\"nogo\">" + reason + "</p>").appendTo("#reasons");
		}

		for(var vid in result.interpretation.scores)
		{
			var val = result.interpretation.scores[vid];

			if (val == 1.0 || val < 0.01)
				continue;
			
			var nuance = "";
			if (val > 0.5)
				nuance = "a bit ";

			var reason = "";

			switch(vid)
			{
			case "wind":           reason = "There is " + (val > 0.5 ? "a bit of " : "") + "wind";  break;
			case "gusts":          reason = "It is " + (val > 0.5 ? "a bit " : "") + "gusty";       break;
			case "crosswind":      reason = "There is " + (val > 0.5 ? "a bit of " : "") + "crosswind"; break;
			case "precipitation":  reason = "It's raining / snowing " + (val > 0.5 ? "a bit" : ""); break;
			case "temperature":    reason = "It's " + (val > 0.5 ? "a bit " : "") + "cold";         break;
			case "cloud_coverage": reason = "It's " + (val > 0.5 ? "a bit " : "") + "cloudy";       break;
			case "vfrConditions":  reason = "The sun is going down soon";                           break;
			}

			$("<p class=\"warn\">" + reason + "</p>").appendTo("#reasons");
		}
	}

	var verdictColor = ComputeVerdictColor(result.verdict, result.interpretation.scores.vfrConditions);
	
	$("#verdict_container").css("background-color", verdictColor[0]);
	$("#verdict_container").css("color", verdictColor[1]);
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

	if (result.interpretation.scores.wind < 1 || result.interpretation.scores.gusts < 1 || result.interpretation.scores.crosswind < 1)
	{
		if (result.interpretation.scores.wind < 0.01 || result.interpretation.scores.gusts < 0.01 || result.interpretation.scores.crosswind < 0.01)
		{
			$('.wind.image img').addClass("nogo");
			$('.wind.content').addClass("nogo");
		}
		else
		{
			$('.wind.image img').addClass("warn");
			$('.wind.content').addClass("warm");
		}
	}

	if (result.interpretation.scores.vfrConditions < 1)
	{
		if (result.interpretation.scores.vfrConditions < 0.01)
		{
			$('.sunset.image img').addClass("nogo");
			$('.sunset.content').addClass("nogo");
		}
		else
		{
			$('.sunset.image img').addClass("warn");
			$('.sunset.content').addClass("warn");
		}
	}

	if (result.interpretation.scores.cloud_coverage < 1)
	{
		if (result.interpretation.scores.cloud_coverage < 0.01)
		{
			$('.cloud_coverage.image img').addClass("nogo");
			$('.cloud_coverage.content').addClass("nogo");
		}
		else
		{
			$('.cloud_coverage.image img').addClass("warn");
			$('.cloud_coverage.content').addClass("warn");
		}
	}
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

function CreateNewForecastItem(item, tr, units)
{
	item.units = units;
	ConvertAllUnits(item);

	var data_title  = FormatForcastDate(new Date(item.time), "yyyy-MM-dd hh:mm");
	var data_html   = "<h4>" + data_title + "</h4><ul>";
	data_html      += "<li><span style='font-weight: bold;'>General weather: </span>" + item.weather.conditions.human_readable + "</li>";
	data_html      += "<li><span style='font-weight: bold;'>Temperature: </span>" + item.weather.temperature + "&deg;" + units.temperature.toUpperCase() + " (dew point: " + item.weather.dew_point + "&deg;" + units.temperature.toUpperCase() + ")</li>";
	data_html      += "<li><span style='font-weight: bold;'>Humidity: </span>" + item.weather.humidity + "%</li>";
	data_html      += "<li><span style='font-weight: bold;'>Cloud coverage: </span>" + item.weather.cloud_coverage + "% / cloud base:  " + item.weather.cloud_base + " " + units.altitude + "</li>";
	data_html      += "<li><span style='font-weight: bold;'>Wind: </span>" + item.weather.wind_direction + " (" + Math.floor(item.weather.wind_heading) + "&deg;), " + item.weather.wind_speed + " " + units.wind_speed + (item.weather.wind_gusts !== undefined ? (" gusting to " + item.weather.wind_gusts + " " + units.wind_speed) : "") + "</li>";
	
	data_html      += "</ul>";

	var tooltip     = '<td class="forecast-item" data-variation="wide" data-position="bottom center" data-html="' + data_html + '"></td>';
	$(tooltip).appendTo(tr);
}

function ComputeForecast(current, forecast)
{
	var forecastGradient = "linear-gradient(to right,";
	$("#forecast_bar_item_contents").html("");

	forecastGradient += ComputeVerdictColor(current.verdict, current.interpretation.scores.vfrConditions)[0];

	forecast.forEach(function(item) {
		forecastGradient += ", " + ComputeVerdictColor(item.verdict, item.interpretation.scores.vfrConditions)[0];
		CreateNewForecastItem(item, $("#forecast_bar_item_contents"), current.units);
	});

	$('.forecast-item').popup();

	forecastGradient += ")";
	console.log(forecastGradient);
	$("#forecast_bar").css("background-image", forecastGradient);
}

$(document).ready(function() {
	console.log("Can I Fly? v0.1.0");

	$.get("/current", function(currentData) {
		$("#reasons").html("");

		$('#location').html(currentData.result.location.lid + " (" + currentData.result.location.location.city + ", " + currentData.result.location.location.state + ", " + currentData.result.location.location.country + ")");

		ComputeVerdict(currentData.result);
		ComputeWeather(currentData.result);

		setTimeout(() => {
			$("#loader").html("Processing 5-day forecast...");
			
			$.get("/forecast", function(forecastData) {
				ComputeForecast(currentData.result, forecastData.result);

				setTimeout(() => {
					$("#data_container").css("visibility", "visible");
					$("#loader").remove();
				}, 500);
			});
		}, 250);
	});
});