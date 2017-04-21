// Define our global variables
var Timer         = null;
var GoogleMap     = null;
var Planes        = {};
var PlanesOnMap   = 0;
var PlanesOnTable = 0;
var PlanesToReap  = 0;
var SelectedPlane = null;
var SpecialSquawk = false;

var iSortCol=-1;
var bSortASC=true;
var bDefaultSortASC=true;
var iDefaultSortCol=3;

// Get current map settings
CenterLat = Number(localStorage['CenterLat']) || CONST_CENTERLAT;
CenterLon = Number(localStorage['CenterLon']) || CONST_CENTERLON;
ZoomLvl   = Number(localStorage['ZoomLvl']) || CONST_ZOOMLVL;

$(document).ready(function() {
	initialize();
});

function fetchData() {
	$.getJSON('/dump1090/data.json', function(data) {
		PlanesOnMap = 0
		SpecialSquawk = false;
		
		// Loop through all the planes in the data packet
		for (var j=0; j < data.length; j++) {
			// Do we already have this plane object in Planes?
			// If not make it.
			if (Planes[data[j].hex]) {
				var plane = Planes[data[j].hex];
			} else {
				var plane = jQuery.extend(true, {}, planeObject);
			}
			
			/*
			// For special squawk tests
			if (data[j].hex == '48413x') {
            	data[j].squawk = '7700';
            }
            */
            
            // Set SpecialSquawk-value
            if (data[j].squawk == '7500' || data[j].squawk == '7600' || data[j].squawk == '7700') {
                SpecialSquawk = true;
            }

			// Call the function update
			plane.funcUpdateData(data[j]);
			
			// Copy the plane into Planes
			Planes[plane.icao] = plane;
		}

		PlanesOnTable = data.length;
	});
}

// Initalizes the map and starts up our timers to call various functions
function initialize() {
	// Make a list of all the available map IDs
	var mapTypeIds = [];
	for(var type in google.maps.MapTypeId) {
		mapTypeIds.push(google.maps.MapTypeId[type]);
	}

	// Define the Google Map
	var mapOptions = {
		center: new google.maps.LatLng(CenterLat, CenterLon),
		zoom: ZoomLvl,
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		mapTypeControl: true,
		streetViewControl: false,
		mapTypeControlOptions: {
			mapTypeIds: mapTypeIds,
			position: google.maps.ControlPosition.TOP_LEFT,
			// style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
		},

		// styles: [{"featureType":"all","stylers":[{"saturation":0},{"hue":"#e7ecf0"}]},{"featureType":"road","stylers":[{"saturation":-70}]},{"featureType":"transit","stylers":[{"visibility":"off"}]},{"featureType":"poi","stylers":[{"visibility":"off"}]},{"featureType":"water","stylers":[{"visibility":"simplified"},{"saturation":-60}]}]
		//styles: [{"featureType":"administrative","elementType":"all","stylers":[{"visibility":"off"}]},{"featureType":"landscape","elementType":"all","stylers":[{"visibility":"simplified"},{"hue":"#0066ff"},{"saturation":74},{"lightness":100}]},{"featureType":"poi","elementType":"all","stylers":[{"visibility":"simplified"}]},{"featureType":"road","elementType":"all","stylers":[{"visibility":"simplified"}]},{"featureType":"road.highway","elementType":"all","stylers":[{"visibility":"off"},{"weight":0.6},{"saturation":-85},{"lightness":61}]},{"featureType":"road.highway","elementType":"geometry","stylers":[{"visibility":"on"}]},{"featureType":"road.arterial","elementType":"all","stylers":[{"visibility":"off"}]},{"featureType":"road.local","elementType":"all","stylers":[{"visibility":"on"}]},{"featureType":"transit","elementType":"all","stylers":[{"visibility":"simplified"}]},{"featureType":"water","elementType":"all","stylers":[{"visibility":"simplified"},{"color":"#5f94ff"},{"lightness":26},{"gamma":5.86}]}]
		// styles: [{"featureType":"water","stylers":[{"saturation":43},{"lightness":-11},{"hue":"#0088ff"}]},{"featureType":"road","elementType":"geometry.fill","stylers":[{"hue":"#ff0000"},{"saturation":-100},{"lightness":99}]},{"featureType":"road","elementType":"geometry.stroke","stylers":[{"color":"#808080"},{"lightness":54}]},{"featureType":"landscape.man_made","elementType":"geometry.fill","stylers":[{"color":"#ece2d9"}]},{"featureType":"poi.park","elementType":"geometry.fill","stylers":[{"color":"#ccdca1"}]},{"featureType":"road","elementType":"labels.text.fill","stylers":[{"color":"#767676"}]},{"featureType":"road","elementType":"labels.text.stroke","stylers":[{"color":"#ffffff"}]},{"featureType":"poi","stylers":[{"visibility":"off"}]},{"featureType":"landscape.natural","elementType":"geometry.fill","stylers":[{"visibility":"on"},{"color":"#b8cb93"}]},{"featureType":"poi.park","stylers":[{"visibility":"on"}]},{"featureType":"poi.sports_complex","stylers":[{"visibility":"on"}]},{"featureType":"poi.medical","stylers":[{"visibility":"on"}]},{"featureType":"poi.business","stylers":[{"visibility":"simplified"}]}]
	};

	GoogleMap = new google.maps.Map(document.getElementById("map"), mapOptions);

	// Listeners for newly created Map
    google.maps.event.addListener(GoogleMap, 'center_changed', function() {
        localStorage['CenterLat'] = GoogleMap.getCenter().lat();
        localStorage['CenterLon'] = GoogleMap.getCenter().lng();
    });
    
    google.maps.event.addListener(GoogleMap, 'zoom_changed', function() {
        localStorage['ZoomLvl']  = GoogleMap.getZoom();
    }); 
	
	// Add home marker if requested
	if (SiteShow && (typeof SiteLat !==  'undefined' || typeof SiteLon !==  'undefined')) {
	    var siteMarker  = new google.maps.LatLng(SiteLat, SiteLon);
	    var markerImage = new google.maps.MarkerImage(
	        'http://maps.google.com/mapfiles/kml/pal4/icon57.png',
            new google.maps.Size(32, 32),   // Image size
            new google.maps.Point(0, 0),    // Origin point of image
            new google.maps.Point(16, 16)); // Position where marker should point 
	    var marker = new google.maps.Marker({
          position: siteMarker,
          map: GoogleMap,
          icon: markerImage,
          title: 'Radar Location',
          zIndex: -99999
        });
        
		if (SiteCircles) {
			for (var i=0;i<SiteCirclesDistances.length;i++) {
				drawCircle(marker, SiteCirclesDistances[i]); // in meters
			}
		}
	}
		
	// Setup our timer to poll from the server.
	Timer = window.setInterval(function() {
		fetchData();
		refreshTableInfo();
		refreshSelected();
		reaper();
	}, 1000);
}

// This looks for planes to reap out of the master Planes variable
function reaper() {
	PlanesToReap = 0;
	// When did the reaper start?
	reaptime = new Date().getTime();
	// Loop the planes
	for (var reap in Planes) {
		// Is this plane possibly reapable?
		if (Planes[reap].reapable == true) {
			// Has it not been seen for 5 minutes?
			// This way we still have it if it returns before then
			// Due to loss of signal or other reasons
			if ((reaptime - Planes[reap].updated) > 300000) {
				// Reap it.
				delete Planes[reap];
			}
			PlanesToReap++;
		}
	};
} 

// Refresh the detail window about the plane
function refreshSelected() {
    var selected = false;
	if (typeof SelectedPlane !== 'undefined' && SelectedPlane != "ICAO" && SelectedPlane != null) {
    	selected = Planes[SelectedPlane];
    }
	
	var columns = 2;
	var html = '<table>';
	
    html += '<tr><th colspan="' + columns + '">';

	// Flight header line including squawk if needed
	if (selected && (selected.flight == "" || selected.flight == "????????")) {
	    html += 'UNKNOWN';
	} else if (selected && selected.flight != "") {
	    html += selected.flight;
	} else {
	    html += 'No Aircraft Selected';
	}

	html += '</th></tr>';

	if (selected && selected.squawk == 7500) { // Lets hope we never see this... Aircraft Hijacking
		html += '<tr><td colspan="' + columns + '" class="squawk squawk7500">Squawking: Aircraft Hijacking</td></tr>';
	} else if (selected && selected.squawk == 7600) { // Radio Failure
		html += '<tr><td colspan="' + columns + '" class="squawk squawk7600">Squawking: Radio Failure</td></tr>';
	} else if (selected && selected.squawk == 7700) { // General Emergency
		html += '<tr><td colspan="' + columns + '" class="squawk squawk7700">Squawking: General Emergency</td></tr>';
	}
	
	html += '<tr>';

	html += '<td><strong>Altitude: </strong>';

	if (selected) {
	    if (Metric) {
        	html += Math.round(selected.altitude / 3.2828) + ' m';
        } else {
            html += selected.altitude + ' ft';
        }
    } else {
        html += '&mdash;';
    }

    html += '</td>';
    html += '<td><strong>Squawk: </strong>';
	
	if (selected && selected.squawk != '0000') {
		html += selected.squawk;
	} else {
	    html += '&mdash;';
	}

    html += '</td>';

	html += '</tr>';
	html += '<tr>';
	
	html += '<td><strong>Speed: </strong>';

	if (selected) {
	    if (Metric) {
	        html += Math.round(selected.speed * 1.852) + ' km/h';
	    } else {
	        html += selected.speed + ' kt';
	    }
	} else {
	    html += '&mdash;';
	}

	html += '</td>';
	
	// if (selected) {
	// 	html += '<td><strong>ICAO (hex):</strong> ' + selected.icao + '</td></tr>';
	// } else {
	// 	html += '<td><strong>ICAO (hex):</strong> &mdash;</td></tr>'; // Something is wrong if we are here
	// }
    
    html += '<td><strong>Track: </strong>';

	if (selected && selected.vTrack) {
	    html += selected.track + '&deg;' + ' (' + normalizeTrack(selected.track, selected.vTrack)[1] +')';
	} else {
	    html += '&mdash;';
	}

    html += '</td>';

	html += '</tr>';
	html += '<tr>';
	
	html += '<td><strong>Lat/Long: </strong>';

	if (selected && selected.vPosition) {
	    html += selected.latitude + ', ' + selected.longitude;
	} else {
		html += '&mdash;';
	}

	html += '</td>';
	    
	// Let's show some extra data if we have site coordinates
	
	if (SiteShow) {
		var siteLatLon  = new google.maps.LatLng(SiteLat, SiteLon);
		var planeLatLon = new google.maps.LatLng(selected.latitude, selected.longitude);
		var dist = google.maps.geometry.spherical.computeDistanceBetween (siteLatLon, planeLatLon);

		if (Metric) {
			dist /= 1000;
		} else {
			dist /= 1852;
		}
		dist = (Math.round((dist)*10)/10).toFixed(1);

		html += '<td><strong>Distance: </strong>';
		if (selected)
		{
			html += dist + (Metric ? ' km' : ' NM');
		}
		else
		{
			html += '&mdash;';
		}
		html += '</td>';
	}
	else
	{
		html += '<td></td>';
	}

	html += '</tr>';

	html += '<tr><td colspan="' + columns + '">';

	if (selected && selected.flight != '') {
		html += '<a href="http://www.flightradar24.com/' + selected.flight + '" class="external" target="_blank" title="View this flight on FlightRadar24"><img src="fr.png" /></a>';
		html += '<a href="http://www.flightstats.com/go/FlightStatus/flightStatusByFlight.do?flightNumber=' + selected.flight + '" class="external" target="_blank" title="View this flight on FlightStats"><img src="fs.png" /></a>';
		html += '<a href="http://www.flightaware.com/live/flight/' + selected.flight + '" class="external" target="_blank" title="View this flight on FlightAware"><img src="fa.png" /></a>';
	}
	else
	{
		html += '<span class="external" title="FlightRadar24 unavailable for this flight"><img src="fr-disabled.png" /></span>';
		html += '<span class="external" title="FlightStats unavailable for this flight"><img src="fs-disabled.png" /></span>';
		html += '<span class="external" title="FlightAware unavailable for this flight"><img src="fa-disabled.png" /></span>';
	}

	html += '</td></tr>';

	html += '</table>';
	
	document.getElementById('plane_detail').innerHTML = html;
}

// Right now we have no means to validate the speed is good
// Want to return (&mdash;) when we dont have it
// TODO: Edit C code to add a valid speed flag
// TODO: Edit js code to use said flag
function normalizeSpeed(speed, valid) {
	return speed	
}

// Returns back a long string, short string, and the track if we have a vaild track path
function normalizeTrack(track, valid){
	x = []
	if ((track > -1) && (track < 22.5)) {
		x = ["North", "N", track]
	}
	if ((track > 22.5) && (track < 67.5)) {
		x = ["North East", "NE", track]
	}
	if ((track > 67.5) && (track < 112.5)) {
		x = ["East", "E", track]
	}
	if ((track > 112.5) && (track < 157.5)) {
		x = ["South East", "SE", track]
	}
	if ((track > 157.5) && (track < 202.5)) {
		x = ["South", "S", track]
	}
	if ((track > 202.5) && (track < 247.5)) {
		x = ["South West", "SW", track]
	}
	if ((track > 247.5) && (track < 292.5)) {
		x = ["West", "W", track]
	}
	if ((track > 292.5) && (track < 337.5)) {
		x = ["North West", "NW", track]
	}
	if ((track > 337.5) && (track < 361)) {
		x = ["North", "N", track]
	}
	if (!valid) {
		x = [" ", "&mdash;", ""]
	}
	return x
}

// Refeshes the larger table of all the planes
function refreshTableInfo() {
	var html = '<table id="tableinfo">';
	html += '<thead><tr>';
	html += '<th onclick="setASC_DESC(\'0\');sortTable(\'tableinfo\',\'0\');" style="text-align: left">ICAO</th>';
	html += '<th onclick="setASC_DESC(\'1\');sortTable(\'tableinfo\',\'1\');" style="text-align: left">Flight</th>';
	html += '<th onclick="setASC_DESC(\'2\');sortTable(\'tableinfo\',\'2\');" style="text-align: right">Squawk</th>';
	html += '<th onclick="setASC_DESC(\'3\');sortTable(\'tableinfo\',\'3\');" style="text-align: right">Altitude</th>';
	html += '<th onclick="setASC_DESC(\'4\');sortTable(\'tableinfo\',\'4\');" style="text-align: right">Speed</th>';
    // Add distance column header to table if site coordinates are provided
    if (SiteShow && (typeof SiteLat !==  'undefined' || typeof SiteLon !==  'undefined')) {
        html += '<th onclick="setASC_DESC(\'5\');sortTable(\'tableinfo\',\'5\');" style="text-align: right">Distance</th>';
    }
	html += '<th onclick="setASC_DESC(\'5\');sortTable(\'tableinfo\',\'6\');" style="text-align: right">Track</th>';
	html += '<th onclick="setASC_DESC(\'6\');sortTable(\'tableinfo\',\'7\');" style="text-align: right">Msgs</th>';
	html += '<th onclick="setASC_DESC(\'7\');sortTable(\'tableinfo\',\'8\');" style="text-align: right">Seen</th></tr></thead><tbody>';
	for (var tablep in Planes) {
		var tableplane = Planes[tablep]
		if (!tableplane.reapable) {
			var specialStyle = "";
			// Is this the plane we selected?
			if (tableplane.icao == SelectedPlane) {
				specialStyle += " selected";
			}
			// Lets hope we never see this... Aircraft Hijacking
			if (tableplane.squawk == 7500) {
				specialStyle += " squawk7500";
			}
			// Radio Failure
			if (tableplane.squawk == 7600) {
				specialStyle += " squawk7600";
			}
			// Emergancy
			if (tableplane.squawk == 7700) {
				specialStyle += " squawk7700";
			}
			
			if (tableplane.vPosition == true) {
				html += '<tr class="plane_table_row valid' + specialStyle + '">';
			} else {
				html += '<tr class="plane_table_row ' + specialStyle + '">';
		    }
		    
			html += '<td>' + tableplane.icao + '</td>';
			
			if (tableplane.flight == "" || tableplane.flight == "????????")
			{
				html += '<td>&mdash;</td>';
			}
			else
			{
				html += '<td>' + tableplane.flight + '</td>';
			}

			if (tableplane.squawk != '0000' ) {
    			html += '<td align="right">' + tableplane.squawk + '</td>';
    	    } else {
    	        html += '<td align="right">&nbsp;</td>';
    	    }
    	    
    	    if (Metric) {
    			html += '<td align="right">' + Math.round(tableplane.altitude / 3.2828) + '</td>';
    			html += '<td align="right">' + Math.round(tableplane.speed * 1.852) + '</td>';
    	    } else {
    	        html += '<td align="right">' + tableplane.altitude + '</td>';
    	        html += '<td align="right">' + tableplane.speed + '</td>';
    	    }

			// Add distance column to table if site coordinates are provided
			if (SiteShow && (typeof SiteLat !==  'undefined' || typeof SiteLon !==  'undefined')) {
			html += '<td align="right">';
			    if (tableplane.vPosition) {
			        var siteLatLon  = new google.maps.LatLng(SiteLat, SiteLon);
			        var planeLatLon = new google.maps.LatLng(tableplane.latitude, tableplane.longitude);
			        var dist = google.maps.geometry.spherical.computeDistanceBetween (siteLatLon, planeLatLon);
			            if (Metric) {
			                dist /= 1000;
			            } else {
			                dist /= 1852;
			            }
			        dist = (Math.round((dist)*10)/10).toFixed(1);
			        html += dist;
			    } else {
			    html += '0';
			    }
			    html += '</td>';
			}

			html += '<td align="right">';
			if (tableplane.vTrack) {
    			 html += normalizeTrack(tableplane.track, tableplane.vTrack)[2];
    			 // html += ' (' + normalizeTrack(tableplane.track, tableplane.vTrack)[1] + ')';
    	    } else {
    	        html += '&nbsp;';
    	    }
    	    html += '</td>';
			html += '<td align="right">' + tableplane.messages + '</td>';
			html += '<td align="right">' + tableplane.seen + '</td>';
			html += '</tr>';
		}
	}
	html += '</tbody></table>';

	document.getElementById('planes_table').innerHTML = html;

	if (SpecialSquawk) {
    	$('.squawk-warning').css('display', 'inline');
    } else {
        $('.squawk-warning').css('display', 'none');
    }

	// Click event for table
	$('#planes_table').find('tr').click( function(){
		var hex = $(this).find('td:first').text();
		if (hex != "ICAO") {
			selectPlaneByHex(hex);
			refreshTableInfo();
			refreshSelected();
		}
	});

	sortTable("tableinfo");
}

// Credit goes to a co-worker that needed a similar functions for something else
// we get a copy of it free ;)
function setASC_DESC(iCol) {
	if(iSortCol==iCol) {
		bSortASC=!bSortASC;
	} else {
		bSortASC=bDefaultSortASC;
	}
}

function sortTable(szTableID,iCol) { 
	//if iCol was not provided, and iSortCol is not set, assign default value
	if (typeof iCol==='undefined'){
		if(iSortCol!=-1){
			var iCol=iSortCol;
                } else if (SiteShow && (typeof SiteLat !==  'undefined' || typeof SiteLon !==  'undefined')) {
                        var iCol=5;
		} else {
			var iCol=iDefaultSortCol;
		}
	}

	//retrieve passed table element
	var oTbl=document.getElementById(szTableID).tBodies[0];
	var aStore=[];

	//If supplied col # is greater than the actual number of cols, set sel col = to last col
	if (typeof oTbl.rows[0] !== 'undefined' && oTbl.rows[0].cells.length <= iCol) {
		iCol=(oTbl.rows[0].cells.length-1);
    }

	//store the col #
	iSortCol=iCol;

	//determine if we are delaing with numerical, or alphanumeric content
	var bNumeric = false;
	if ((typeof oTbl.rows[0] !== 'undefined') &&
	    (!isNaN(parseFloat(oTbl.rows[0].cells[iSortCol].textContent ||
	    oTbl.rows[0].cells[iSortCol].innerText)))) {
	    bNumeric = true;
	}

	//loop through the rows, storing each one inro aStore
	for (var i=0,iLen=oTbl.rows.length;i<iLen;i++){
		var oRow=oTbl.rows[i];
		vColData=bNumeric?parseFloat(oRow.cells[iSortCol].textContent||oRow.cells[iSortCol].innerText):String(oRow.cells[iSortCol].textContent||oRow.cells[iSortCol].innerText);
		aStore.push([vColData,oRow]);
	}

	//sort aStore ASC/DESC based on value of bSortASC
	if (bNumeric) { //numerical sort
		aStore.sort(function(x,y){return bSortASC?x[0]-y[0]:y[0]-x[0];});
	} else { //alpha sort
		aStore.sort();
		if(!bSortASC) {
			aStore.reverse();
	    }
	}

	//rewrite the table rows to the passed table element
	for(var i=0,iLen=aStore.length;i<iLen;i++){
		oTbl.appendChild(aStore[i][1]);
	}
	aStore=null;
}

function selectPlaneByHex(hex) {
	// If SelectedPlane has something in it, clear out the selected
	if (SelectedPlane != null) {
		Planes[SelectedPlane].is_selected = false;
		Planes[SelectedPlane].funcClearLine();
		Planes[SelectedPlane].markerColor = MarkerColor;
		// If the selected has a marker, make it not stand out
		if (Planes[SelectedPlane].marker) {
			Planes[SelectedPlane].marker.setIcon(Planes[SelectedPlane].funcGetIcon());
		}
	}

	// If we are clicking the same plane, we are deselected it.
	if (String(SelectedPlane) != String(hex)) {
		// Assign the new selected
		SelectedPlane = hex;
		Planes[SelectedPlane].is_selected = true;
		// If the selected has a marker, make it stand out
		if (Planes[SelectedPlane].marker) {
			Planes[SelectedPlane].funcUpdateLines();
			Planes[SelectedPlane].marker.setIcon(Planes[SelectedPlane].funcGetIcon());
		}
	} else { 
		SelectedPlane = null;
	}
    refreshSelected();
    refreshTableInfo();
}

function resetMap() {
    // Reset localStorage values
    localStorage['CenterLat'] = CONST_CENTERLAT;
    localStorage['CenterLon'] = CONST_CENTERLON;
    localStorage['ZoomLvl']   = CONST_ZOOMLVL;
    
    // Try to read values from localStorage else use CONST_s
    CenterLat = Number(localStorage['CenterLat']) || CONST_CENTERLAT;
    CenterLon = Number(localStorage['CenterLon']) || CONST_CENTERLON;
    ZoomLvl   = Number(localStorage['ZoomLvl']) || CONST_ZOOMLVL;
    
    // Set and refresh
	GoogleMap.setZoom(parseInt(ZoomLvl));
	GoogleMap.setCenter(new google.maps.LatLng(parseFloat(CenterLat), parseFloat(CenterLon)));
	
	if (SelectedPlane) {
	    selectPlaneByHex(SelectedPlane);
	}

	refreshSelected();
	refreshTableInfo();
}

function drawCircle(marker, distance) {
    if (typeof distance === 'undefined') {
        return false;
        
        if (!(!isNaN(parseFloat(distance)) && isFinite(distance)) || distance < 0) {
            return false;
        }
    }
    
    distance *= 1000.0;
    if (!Metric) {
        distance *= 1.852;
    }
    
    // Add circle overlay and bind to marker
    var circle = new google.maps.Circle({
      map: GoogleMap,
      radius: distance, // In meters
      fillOpacity: 0.0,
      strokeWeight: 1,
      strokeOpacity: 0.3
    });
    circle.bindTo('center', marker, 'position');
}
