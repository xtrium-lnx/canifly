const fs = require("fs");
const es = require("event-stream");

function GetSurfaceType(sfcType)
{
	switch(sfcType)
	{
	case "1":  return "asphalt";
	case "2":  return "concrete";
	case "3":  return "turf / grass";
	case "4":  return "dirt";
	case "5":  return "gravel";
	case "12": return "dry lakebed";
	case "13": return "water";
	case "14": return "snow / ice";
	}

	return "unknown";
}

function ParseContents(apt)
{
	console.log("Parsing contents...");

	apt.shift();
	apt.shift();
	apt.pop();

	var airports = {};

	var currentAirport = null;

	apt.forEach(function(line) {
		if (line == "")
			return;

		if (line[0] == "#")
			return;

		var tokens = line.split(/[ \t]+/);

		if (tokens[0] == "1" || tokens[0] == "16" || tokens[0] == "17")
		{ // New airport / airfield / heliport
			if (currentAirport)
			{
				if (currentAirport.location.country == "Canada")
				airports[currentAirport.lid] = currentAirport;
			}

			currentAirport = {
				name: tokens.slice(5).join(" "),
				lid: tokens[4],
				location: {},
				runways: []
			};
		}

		if (tokens[0] == "1302")
		{ // Location data
			switch(tokens[1])
			{
			case "city":
				currentAirport.location["city"] = tokens.slice(2).join(" ");
				return;

			case "state":
				currentAirport.location["state"] = tokens.slice(2).join(" ");
				return;

			case "country":
				currentAirport.location["country"] = tokens.slice(2).join(" ");
				return;

			case "datum_lat":
				currentAirport.location["latitude"] = parseFloat(tokens[2]);
				return;

			case "datum_lon":
				currentAirport.location["longitude"] = parseFloat(tokens[2]);
				return;
			}
		}

		if (tokens[0] == 100)
		{ // Runway
			var runway1 = {
				width:       parseFloat(tokens[1]),
				surfaceType: GetSurfaceType(tokens[2]),
				name:        tokens[8],
				lat_start:   parseFloat(tokens[9]),
				lon_start:   parseFloat(tokens[10]),
				lat_end:     parseFloat(tokens[18]),
				lon_end:     parseFloat(tokens[19]),
				threshold:   parseFloat(tokens[11]),
			};

			var runway2 = {
				width:       parseFloat(tokens[1]),
				surfaceType: GetSurfaceType(tokens[2]),
				name:        tokens[17],
				lat_start:   runway1.lat_end,
				lon_start:   runway1.lon_end,
				lat_end:     runway1.lat_start,
				lon_end:     runway1.lon_start,
				threshold:   parseFloat(tokens[20]),
			};

			currentAirport.runways.push(runway1);
			currentAirport.runways.push(runway2);
		}
	});

	if (currentAirport)
		if (currentAirport.location.country == "Canada")
			airports[currentAirport.lid] = currentAirport;

	return airports;
}

function main() {

	console.log("Reading apt.dat file...");

	var allLines = [];

	var s = fs.createReadStream('apt.dat')
		.pipe(es.split())
		.pipe(es.mapSync(function(line) {
			allLines.push(line);
		})
		.on('error', err => { throw err; })
		.on('end', function() {
			var airports = ParseContents(allLines);
			fs.writeFileSync('data/airport_details.json', JSON.stringify(airports));
		})
	);
}

console.log("CanIFly? - apt.dat parser");
console.log("=========================");
console.log("");
main();
