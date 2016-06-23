(function(config) {
	var units = {};
	var formatDate = '';
	var $overlaytab = $('#overlay-tab');
	var $tabbody = $('#tabbody');
	var $scheme = $('#scheme');
	var $schemeHead = $('#scheme-head');
	var $btnprint = $('#btn-print');
	var $units = $('#units');
	var $error = $('#error');
	var session = null;

	document.title = config.name;
	$('.top .wrap p').html(config.name);

	// Wialon script loading
	var url = getHtmlVar("baseUrl") || getHtmlVar("hostUrl") || "https://hst-api.wialon.com";
	loadScript(url+"/wsdk/script/wialon.js", initSdk);

	// Get language
	var lang = getHtmlVar("lang") || config.lang;
	if (["en", "ru", "fr"].indexOf(lang) == -1){
		lang = config.lang;
	}

	// Set translation
	$.localise("lang/", {language:lang, complete:ltranslate});
	translate = $.localise.tr;

	// Load datepicker locale
	if (lang != "en") {
		loadScript("//apps.wialon.com/plugins/wialon/i18n/" + lang + ".js");
	}

	events();

	/** FUNCTION FOR WIALON SCRIPT LOADING */
	function loadScript(src, callback) {
		var script = document.createElement("script");

		script.setAttribute("type", "text/javascript");
		script.setAttribute("charset", "UTF-8");
		script.setAttribute("src", src);

		if (callback && typeof callback === "function") {
			script.onload = callback;
		}

		document.getElementsByTagName("head")[0].appendChild(script);
	}

	/** SDK INITIALIZING */
	function initSdk() {
		var url = getHtmlVar("baseUrl");
		if(!url) {
			url = getHtmlVar("hostUrl");
		}
		if(!url) {
			url = 'https://hst-api.wialon.com';
		}

		var params = {
			'authHash' : getHtmlVar("authHash") || getHtmlVar("access_hash"),
			'sid' : getHtmlVar("sid"),
			'token' : getHtmlVar("token") || getHtmlVar("access_token")
		};

		// Session initialize
		session = wialon.core.Session.getInstance();
		session.initSession(url);
		session.loadLibrary("unitEvents");

		smartLogin(params);
	}

	/** AUTHORIZATION */
	function smartLogin(params) {
		var user = getHtmlVar("user") || "";

		if(params.authHash) {
			session.loginAuthHash(params.authHash, function(code) {loginCallback(code, params, 'authHash')});
		} else if (params.sid) {
			session.duplicate(params.sid, user, true, function(code) {loginCallback(code, params, 'sid')});
		} else if (params.token) {
			session.loginToken(params.token, function(code) {loginCallback(code, params, 'token')});
		} else {
			redirectToLoginPage();
		}
	}

	/** LOGIN CALLBACK */
	function loginCallback(code, params, param) {
		if (code) {
			delete params[param];

			smartLogin(params);
		} else {
			var user = session.getCurrUser();

			user.getLocale(function(arg, locale) {
				// Check for users who have never changed the parameters of the metric
				var fd = (locale && locale.fd) ? locale.fd : '%Y-%m-%E_%H:%M:%S';

				var initDatepickerOpt = {
					wd_orig: locale.wd,
					fd: fd
				};

				var regional = $.datepicker.regional[lang];
				if (regional) {
					$.datepicker.setDefaults(regional);

					// Also wialon locale
					wialon.util.DateTime.setLocale(
						regional.dayNames,
						regional.monthNames,
						regional.dayNamesShort,
						regional.monthNamesShort
					);
				}

				initDatepicker(initDatepickerOpt.fd, initDatepickerOpt.wd_orig);
				addItemsToSelectBox();
			});
		}
	}

	/** REDIRECT TO LOGIN PAGE */
	function redirectToLoginPage() {
		var cur = window.location.href;

		// Remove bad parameters from url
		cur = cur.replace(/\&{0,1}(sid|token|authHash|access_hash|access_token)=\w*/g, '');
		cur = cur.replace(/[\?\&]*$/g, '');

		var url = config.homeUrl + '/login.html?client_id=' + config.name + '&lang=' + lang + '&duration=3600&redirect_uri=' + encodeURIComponent(cur);

		window.location.href = url;
	}

	/** DATEPICKER INITIALIZING */
	function initDatepicker(setDateFormat, firstDayOrig) {
		var options = {
			template: '<div class="interval-wialon {className}" id="{id}">' +
							'<div class="iw-select">' +
								'<button data-period="0" type="button" class="iw-period-btn period_0">{yesterday}</button>' +
								'<button data-period="1" type="button" class="iw-period-btn period_1">{today}</button>' +
								'<button data-period="2" type="button" class="iw-period-btn period_2">{week}</button>' +
								'<button data-period="3" type="button" class="iw-period-btn period_3">{month}</button>' +
								'<button data-period="4" type="button" class="iw-period-btn period_4">{custom}</button>' +
							'</div>' +
							'<div class="iw-pickers">' +
								'<input type="text" class="iw-from" id="date-from"/> &ndash; <input type="text" class="iw-to" id="date-to"/>' +
								'<button type="button" class="iw-time-btn">{ok}</button>' +
							'</div>' +
							'<div class="iw-labels">' +
								'<a href="#" class="iw-similar-btn past" data-similar="past"></a> ' +
								'<span class="iw-label"></span> ' +
								'<a href="#" class="iw-similar-btn future" data-similar="future"></a>' +
							'</div>' +
						'</div>',
			labels: {
				yesterday: translate('Yesterday'),
				today: translate('Today'),
				week: translate('Week'),
				month: translate('Month'),
				custom: translate('Custom'),
				ok: "OK"
			},
			datepicker: {},
			onInit: function(){
				$("#ranging-time-wrap").intervalWialon('set', 3);
			},
			onChange: function(data){
				currentInterval = $("#ranging-time-wrap").intervalWialon('get');
			},
			onAfterClick: function () {
			},
			tzOffset: wialon.util.DateTime.getTimezoneOffset(),
			now: session.getServerTime(),
		};

		options.dateFormat = wialon.util.DateTime.convertFormat(setDateFormat.split('_')[0], true);
		options.firstDay = firstDayOrig;

		// Remember date format
		formatDate = setDateFormat.split('_')[0];

		$("#ranging-time-wrap").intervalWialon(options);
	}

	/** ITEMS ADDITION INTO SELECTBOX AND PRINT OF THE FIRST(SELECTED) IGNITION */
	function addItemsToSelectBox() {
		var searchSpec = {
			itemsType:"avl_unit", // Type of the required elements of Wialon
			propName: "sys_name", // Name of the characteristic according to which the search will be carried out
			propValueMask: "*",   // Meaning of the characteristic: can be used * | , > < =
			sortType: "sys_name"  // The name of the characteristic according to which you will be sorting a response
		};
		var dataFlags = wialon.item.Item.dataFlag.base;

		// Request of the search for objects
		session.searchItems(searchSpec, true, dataFlags, 0, 0, function(code, data) {
			if (code) {
				alert(wialon.core.Errors.getErrorText(code));
				return;
			}
			// Generation of select-box data
			var select = '<option disabled="disabled">' + translate('Choose unit') + ' <object data="" type=""></object></option>';
			for(i=0; i<data.totalItemsCount; i++){
				if(i == 0) {
					select += '<option value="' + data['items'][i].getId() + '" selected>' + data['items'][i].getName() + '</option>';
				} else {
					select += '<option value="' + data['items'][i].getId() + '">' + data['items'][i].getName() + '</option>';
				}
				units[data['items'][i].getId()] = data['items'][i];
			}

			$units.html(select);

			// IgnitionConfig of the first(selected) ignition
			ignitionConfig(units[data['items'][0].getId()]);
		});
	}

	/* PREPARATION OF OPERATION TIME OF IGNITION */
	function prepareOperTime(time) {
		var h = Math.floor(time/3600);
		var m = Math.floor((time - h*3600)/60);
		var s = Math.floor(time - h*3600 - m*60);

		if(h == 24) {
			h = 23;
			m = 59;
			s = 59;
		}

		var stringTime = h + ':';

		stringTime += (m < 10) ? '0' + m + ':' : m + ':';

		stringTime += (s < 10) ? '0' + s : s;

		return stringTime;
	}

	/** PREPARATION OF CODE OF SCHEME */
	function prepareSchemeCode(data, beginDay, endDay) {
		var result = [];
		var sum = 0;
		var timeEnd = beginDay;
		var resTime = 0;
		var schemeCode = '';

		for(var j = 0; j < data.length; j++) {
			if(data[j].to.t > beginDay && data[j].from.t < beginDay + 86400) {
				var clear = 0;
				var color = 0;

				if(data[j].from.t >= beginDay) {
					clear = (data[j].from.t - timeEnd);

					if(data[j].to.t < endDay) {
						color = (data[j].to.t - data[j].from.t);
					} else {
						color = (endDay - data[j].from.t);
					}
				} else {
					clear = 0;

					if(data[j].to.t < endDay) {
						color = (data[j].to.t - beginDay);
					} else {
						color = (endDay - beginDay);
					}
				}

				timeEnd = data[j].to.t;

				resTime += color;

				sum += clear;

				schemeCode += '<div class="in" style="left: ' + sum/864 + '%; width: ' + color/864 + '%;"></div>';

				sum += color;
			}
		}

		result.push(resTime);
		result.push(schemeCode);

		return result;
	}

	/** SCALE PREPARATION OF SCHEME */
	function prepareScale() {
		var code = '';

		for(var i = 0; i <= 24; i++) {
			switch (i) {
				case 0:
				case 6:
					code += '<span><i></i><time>0' + i + ':00</time></span>';
					break;
				case 12:
				case 18:
				case 24:
					code += '<span><i></i><time>' + i + ':00</time></span>'
					break;
				default:
					code += '<span><i></i></span>';
			}
		}

		return code;
	}

	/** IGNITION DEPICTION */
	function printIgnition(data, int1, int2) {
		var code = [];
		var countDays = Math.round((int2 - int1) / 86400);

		if(data) {
			var beginDay = int1;
			var endDay = int1 + 86400;
			var list = [];
			var $tr = $('<tr>' +
							'<td class="date" data-date=""></td>' +
							'<td class="scheme">' +
								'<div class="sch-top">' +
								'<div class="border"></div>' +
								'<div class="lines">' + prepareScale() + '</div>' +
								'</div>' +
							'</td>' +
							'<td class="time" data-time=""></td>' +
						'</tr>');

			for(var j = 0; j < countDays; j++) {
				var day = wialon.util.DateTime.formatDate(beginDay, formatDate);
				list.push(day);
				beginDay += 86400;
			}

			beginDay = int1;

			for(var i = 0; i < list.length; i++) {
				var schemeCodeResult = prepareSchemeCode(data, beginDay, endDay);
				var resTime = schemeCodeResult[0];
				var schemeCode = schemeCodeResult[1];
				var $cloneTr = $tr.clone();

				$('.date', $cloneTr).attr('data-date', beginDay).html(list[i]);
				$('.scheme .border', $cloneTr).html(schemeCode);
				$('.time', $cloneTr).attr('data-time', resTime).html(prepareOperTime(resTime));

				code.push($cloneTr);

				beginDay += 86400;
				endDay += 86400;
			}
		} else {
			code.push($('<tr><td colspan="3" style="text-align: center;" id="no-sensor">' + translate('No ignition sensor.') + '</td></tr>'));
		}

		$tabbody.html(code);
	}

	/** IGNITION CONFIGURATION */
	function ignitionConfig(th) {
		var events_config = {
			itemId: th.getId(),
			eventType: 'ignition',
			ivalType: 4,
			ivalFrom: currentInterval[0],
			ivalTo: currentInterval[1]
		};
		
		wialon.core.Remote.getInstance().remoteCall(
			"unit/get_events",
			events_config,
			function (code, data) {
				var t1 = new Date();
				printIgnition(data.ignition[Object.keys(data.ignition)[0]], currentInterval[0], currentInterval[1]);
				var t2 = new Date();

				sortTable('date', 'up');

				setTimeout(function() {
					$overlaytab.addClass('inactive');
				}, t2-t1);
			});
	}

	/** EVENTS */
	function events() {
		var $rtw = $('#ranging-time-wrap');

		// Click on select-box
		$units.on('click', function() {
			var id = $('option:selected', $units).val();

			if(id) {
				var th = units[id];
				$overlaytab.removeClass('inactive');
				$tabbody.html('');
				ignitionConfig(th);
			}
		});

		// Click on date interval
		$rtw.on('click', '.iw-period-btn, .iw-time-btn', function() {
			if($(this).index() !== 4) {
				var id = $('option:selected', $units).val();

				if(id) {
					var th = units[id];
					$overlaytab.removeClass('inactive');
					$tabbody.html('');
					ignitionConfig(th);
				}
			}
		});

		// Print click
		$btnprint.on('click', function() {
			print();
		});

		// Filter click
		$schemeHead.on('click', 'thead>tr>th', function() {
			if($(this).hasClass('date')) {
				if($(this).hasClass('up')) {
					sortTable('date', 'down');
				} else {
					sortTable('date', 'up');
				}
			}

			if($(this).hasClass('time')) {
				if($(this).hasClass('up')) {
					sortTable('time', 'down');
				} else {
					sortTable('time', 'up');
				}
			}
		})
	}

	/** TABLE SORTING */
	function sortTable(name, dir) {
		if(name) {
			var list = [];
			var dataList = [];
			var resultList = [];

			$('#scheme-head>thead>tr>th').each(function() {
				$(this).removeClass('down');
				$(this).removeClass('up');
			});

			$('#scheme-head>thead>tr>th.' + name).addClass(dir);

			$tabbody.find('tr').each(function() {
				list.push($(this));
			});

			$tabbody.find('.' + name).each(function() {
				dataList.push($(this).attr('data-' + name));
			});

			if(dataList.length != 0) {
				dataList.sort(compare);

				if(dir == 'down') {
					dataList.reverse();
				}

				inf: for (var i = 0; i < dataList.length; i++) {
					for (var j = 0; j < list.length; j++) {
						if (list[j].find('.' + name).attr('data-' + name) == dataList[i]) {
							resultList.push(list[j]);

							if(name == 'date') {
								continue inf;
							}
						}
					}
				}

				$tabbody.html(resultList);
			}
		}
	}

	/** FILTER */
	function compare(o1, o2) {
		if (o2 < o1) {
			return 1;
		} else if (o2 > o1) {
			return -1;
		}
		return 0;
	}

	/** PRINT TABLE OF IGNITION */
	function print() {
		var resultCode = '';
		var window_;
		var beginCode = '<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" type="text/css" href="css/style.css"/>' +
					'</head><body>' +
					'<p style="text-align: right; font-size: 12px;">' + translate('Interval') + ' - ' + $('.iw-label', '#ranging-time-wrap').text() + '</p>' +
					'<h1 style="text-align: center;">' + translate('Engine operation') + '</h1>' +
					'<p>' + translate('Unit') + ' - ' + $('option:selected', $units).text() + '</p>' +
					'<div class="content"><div class="wrap" style="width: 100%;" ">' +
						'<table>' + $schemeHead.clone().html() + '</table>' +
						'<div class="tabbody"><table>';
		var tableCode = $($scheme.clone().html());
		var endCode = '</table></div></div></div></body></html>';

		chartsToCanvas(tableCode);

		resultCode = beginCode + tableCode.html() + endCode;

		window_ = window.open('about:blank', 'Print', 'left=300,top=300,right=500,bottom=500,width=1000,height=500');

		window_.document.open();
		window_.document.write(resultCode);
		window_.document.close();

		setTimeout( function() {
			window_.focus();
			window_.print();
			window_.close();
		}, 500 );

		return this;
	}

	/** SCHEMES CONVERTION INTO CANVAS FOR PRINTING IT */
	function chartsToCanvas(scheme) {
		var canvas = document.createElement('canvas'),
			ctx, img;
		canvas.width = 1;
		canvas.height = 1;

		// Rebuild div to canvas
		scheme.find('.border div').each(function(k, v) {
			ctx = canvas.getContext('2d');
			ctx.fillStyle = $(this).css('background');
			ctx.fillRect(0, 0, 1, 1);

			// Create new image
			img = $('<img src="'+ canvas.toDataURL() +'" />');
			img.attr('class', $(this).attr('class'));
			img.attr('style', $(this).attr('style'));

			// Replace current div with image (because we can't print div with background colors)
			$(this).replaceWith(img);
		} );
	}

	/** ELEMENTS TRANSLATION */
	function ltranslate() {
		$btnprint.attr('title', translate('Print'));
		$('.date', '#scheme-head').html(translate('Date') + ' <span class="arrow"></span>');
		$('.sch', '#scheme-head').html(translate('Engine operation'));
		$('.time', '#scheme-head').html(translate('ON time') + ' <span class="arrow"></span>');
	}

	/** FUNCTION FOR STRING TRANSLATION */
	function translate(txt){
		var result = txt;
		if (typeof TRANSLATIONS !== "undefined" && typeof TRANSLATIONS === "object" && TRANSLATIONS[txt]) {
			result = TRANSLATIONS[txt];
		}
		return result;
	}

	/** GET URL PARAMETERS */
	function getHtmlVar(name) {
		if (!name) {
			return null;
		}
		var pairs = document.location.search.substr(1).split("&");
		for (var i = 0; i < pairs.length; i++) {
			var pair = pairs[i].split("=");
			if (decodeURIComponent(pair[0]) === name) {
				var param = decodeURIComponent(pair[1]);
				param = param.replace(/[?]/g, '');
				return param;
			}
		}
		return null;
	}
})(config);