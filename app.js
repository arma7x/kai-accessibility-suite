function distVincenty(lat1, lon1, lat2, lon2) {
  var a = 6378137,
      b = 6356752.314245,
      f = 1 / 298.257223563; // WGS-84 ellipsoid params
  var L = (lon2 - lon1).toRad();
  var U1 = Math.atan((1 - f) * Math.tan(lat1.toRad()));
  var U2 = Math.atan((1 - f) * Math.tan(lat2.toRad()));
  var sinU1 = Math.sin(U1),
      cosU1 = Math.cos(U1);
  var sinU2 = Math.sin(U2),
      cosU2 = Math.cos(U2);

  var lambda = L,
      lambdaP, iterLimit = 100;
  do {
    var sinLambda = Math.sin(lambda),
        cosLambda = Math.cos(lambda);
    var sinSigma = Math.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) + (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));
    if (sinSigma == 0) return 0; // co-incident points
    var cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    var sigma = Math.atan2(sinSigma, cosSigma);
    var sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
    var cosSqAlpha = 1 - sinAlpha * sinAlpha;
    var cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
    if (isNaN(cos2SigmaM)) cos2SigmaM = 0; // equatorial line: cosSqAlpha=0 (§6)
    var C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda = L + (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);

  if (iterLimit == 0) return NaN // formula failed to converge
  var uSq = cosSqAlpha * (a * a - b * b) / (b * b);
  var A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  var B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  var deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) - B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
  var s = b * A * (sigma - deltaSigma);

  s = s.toFixed(3); // round to 1mm precision
  return s;
}

Number.prototype.toRad = function() {
    return this * Math.PI / 180;
}

Number.prototype.toDeg = function() {
    return this * 180 / Math.PI;
}

const getMyLocation = function(strict = false) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition((location) => {
      if (strict) {
        resolve(location);
        return;
      }
      fetch(`https://geocode.xyz/${location.coords.latitude},${location.coords.longitude}?geoit=json`)
      .then((response) => {
        if (response.status >= 400)
          return Promise.reject(response.status);
        return response.json()
      })
      .then((json) => {
        resolve({ latitude: location.coords.latitude, longitude: location.coords.longitude, country: json.region});
      })
      .catch(() => {
        resolve({ latitude: location.coords.latitude, longitude: location.coords.longitude, country: 'Unknown'});
      })
    }, (err) => {
      if (strict) {
        reject(err);
        return;
      }
      fetch(`https://malaysiaapi.herokuapp.com/geoservice/api/v1/get-ip-by-location`)
      .then((response) => {
        if (response.status >= 400)
          return Promise.reject(response.status);
        return response.json()
      })
      .then((json) => {
        resolve({ latitude: json.latitude, longitude: json.longitude, country: json.country_name});
      })
      .catch((err) => {
        reject(err);
      })
    });
  });
}

const getWeatherForecast = function(lat, long) {
  return fetch(`https://malaysiaapi.herokuapp.com/proxy?url=https://www.metaweather.com/api/location/search/?lattlong=${lat},${long}`)
  .then((response) => {
    if (response.status >= 400)
      return Promise.reject(response.status);
    return response.json()
  })
  .then((json) => {
    return fetch(`https://malaysiaapi.herokuapp.com/proxy?url=https://www.metaweather.com/api/location/${json[0].woeid}/`)
  })
  .then((response) => {
    if (response.status >= 400)
      return Promise.reject(response.status);
    return response.json()
  })
  .then((json) => {
    return Promise.resolve(json);
  })
  .catch((err) => {
    return Promise.reject(err);
  })
}

const pushLocalNotification = function(text) {
  window.Notification.requestPermission().then(function(result) {
    var notification = new window.Notification(text);
      notification.onclick = function(event) {
        if (window.navigator.mozApps) {
          var request = window.navigator.mozApps.getSelf();
          request.onsuccess = function() {
            if (request.result) {
              notification.close();
              request.result.launch();
            }
          };
        } else {
          window.open(document.location.origin, '_blank');
        }
      }
      notification.onshow = function() {
        notification.close();
      }
  });
}

window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  const state = new KaiState({
    'weather': {},
  });

  const battery = new Kai({
    name: 'battery',
    data: {
      title: 'battery',
      opts: []
    },
    verticalNavClass: '.batteryNav',
    components: [],
    templateUrl: document.location.origin + '/templates/battery.html',
    mounted: function() {
      // this.$router.setHeaderTitle('Battery Info');
    },
    unmounted: function() {},
    methods: {
      getBatteryInfo: function(type) {
        if (type === 1) {
          this.$router.showDialog('Battery', `<div class="kai-list-nav"><span class="sr-only">Battery level is ${(navigator.battery.level* 100).toFixed()}%. Press Left key to close.</span><span aria-hidden="true">Battery level is ${(navigator.battery.level* 100).toFixed()}%</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
        } else if (type === 2) {
          this.$router.showDialog('Battery', `<div class="kai-list-nav"><span class="sr-only">Battery is ${navigator.battery.charging ? 'charging' : 'not charging'}. Press Left key to close.</span><span aria-hidden="true">Battery is ${navigator.battery.charging ? 'charging' : 'not charging'}</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
        } else if (type === 3) {
          this.$router.showDialog('Battery', `<div class="kai-list-nav"><span class="sr-only">Battery temperature is ${navigator.battery.temperature.toFixed()} degree celcius. Press Left key to close.</span><span aria-hidden="true">Battery temperature is ${navigator.battery.temperature.toFixed()} degree celcius</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
        } else if (type === 4) {
          this.$router.showDialog('Battery', `<div class="kai-list-nav"><span class="sr-only">Battery status is ${navigator.battery.health}. Press Left key to close.</span><span aria-hidden="true">Battery status is ${navigator.battery.health}</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
        }
      }
    },
    softKeyText: { left: '', center: 'SELECT', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          listNav[this.verticalNavIndex].click();
        }
      },
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowRight: function() {
        // this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      },
      arrowLeft: function() {
        // this.navigateTabNav(1);
      },
    }
  });

  const dateTime = new Kai({
    name: 'dateTime',
    data: {
      title: 'dateTime',
      opts: []
    },
    verticalNavClass: '.dateTimeNav',
    components: [],
    templateUrl: document.location.origin + '/templates/dateTime.html',
    mounted: function() {
      // this.$router.setHeaderTitle('Date and Time Info');
    },
    unmounted: function() {},
    methods: {
      getCurrentTime: function(type) {
        if (type === 1) {
          this.$router.showDialog('Date and Time', `<div class="kai-list-nav"><span class="sr-only">Current time is ${new Date().toLocaleTimeString()}. Press Left key to close.</span><span aria-hidden="true">Current time is ${new Date().toLocaleTimeString()}</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
        } else if (type === 2) {
          this.$router.showDialog('Date and Time', `<div class="kai-list-nav"><span class="sr-only">Current date is ${new Date().toDateString()}. Press Left key to close.</span><span aria-hidden="true">Current date is ${new Date().toDateString()}</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
        } else if (type === 3) {
          const d = new Date();
          const full = `${d.toLocaleTimeString()}, ${d.toDateString()}`;
          this.$router.showDialog('Date and Time', `<div class="kai-list-nav"><span class="sr-only">Current time and date are ${full}. Press Left key to close.</span><span aria-hidden="true">Current time and date are ${full}</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
        }
      }
    },
    softKeyText: { left: '', center: 'SELECT', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          listNav[this.verticalNavIndex].click();
        }
      },
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowRight: function() {
        // this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      },
      arrowLeft: function() {
        // this.navigateTabNav(1);
      },
    }
  });

  const weather = new Kai({
    name: 'weather',
    data: {
      title: 'weather',
      opts: [
        {
          'screen_reader': 'Please wait while we getting a weather forecast,',
          'text': 'Please wait...',
        }
      ]
    },
    verticalNavClass: '.weatherNav',
    components: [],
    templateUrl: document.location.origin + '/templates/weather.html',
    mounted: function() {
      this.$router.setHeaderTitle('Weather Forecast');
      this.$state.setState('weather', {});
      this.methods.getWeather();
      this.$state.addStateListener('weather', this.methods.weatherEvent);
    },
    unmounted: function() {
      this.$state.removeStateListener('weather', this.methods.weatherEvent);
    },
    methods: {
      getWeather: function() {
        getMyLocation()
        .then((pos) => {
          return getWeatherForecast(pos.latitude, pos.longitude);
        })
        .then((forecast) => {
          pushLocalNotification(`Success`);
          setTimeout(() => {
            this.$state.setState('weather', forecast);
          }, 1000);
        })
        .catch((err) => {
          pushLocalNotification(`Error, please press Back to return,`);
        })
      },
      weatherEvent: function(forecast) {
        if (Object.keys(forecast).length > 0) {
          var data = [];
          if (forecast.title) {
            data.push({
              'screen_reader': `${forecast.title} Weather Forecast for the next 6 days. Use Arrow Up and Arrow Down button to navigate the menu. Press Back to return,`,
              'text': `Weather Forecast`,
              'subtext': `${forecast.title}`,
            });
            for (var f in forecast.consolidated_weather) {
              const d = forecast.consolidated_weather[f];
              data.push({
                'screen_reader': `Weather forecast for ${new Date(d.applicable_date).toDateString()}, weather condition is ${d.weather_state_name}, humidity is ${d.humidity}%, minimum temperature is ${d.min_temp.toFixed()} degree celcius, maximum temperature is ${d.max_temp.toFixed()} degree celcius, wind speed is ${d.wind_speed.toFixed()}mph, forecast accuracy is ${d.predictability}%`,
                'text': `${new Date(d.applicable_date).toDateString()}`,
                'subtext': `${d.weather_state_name}, min ${d.min_temp.toFixed()}°, max ${d.max_temp.toFixed()}°`,
              });
            }
            this.setData({opts: []});
            setTimeout(() => {
              this.setData({
                opts: data
              });
            }, 500);
          }
        }
      }
    },
    softKeyText: { left: '', center: '', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          listNav[this.verticalNavIndex].click();
        }
      },
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowRight: function() {
        // this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      },
      arrowLeft: function() {
        // this.navigateTabNav(1);
      }
    },
    backKeyListener: function() {
      this.$state.setState('weather', {});
    }
  });

  const geolocation = new Kai({
    name: 'geolocation',
    data: {
      title: 'geolocation',
      opts: []
    },
    verticalNavClass: '.geolocationNav',
    components: [],
    templateUrl: document.location.origin + '/templates/geolocation.html',
    mounted: function() {
      // this.$router.setHeaderTitle('Geolocation Services');
    },
    unmounted: function() {},
    methods: {
      shareMyLocation: function() {
        this.$router.showDialog('Notice', `<div class="kai-list-nav"><span class="sr-only">Please wait.</span><span aria-hidden="true">Please wait</span></div>`, null, ' ', () => {}, ' ', () => {}, ' ', () => {}, () => {});
        this.$router.showLoading();
        getMyLocation(true)
        .then((location) => {
          console.log(location.coords.accuracy, location.coords.latitude, location.coords.longitude);
          this.$router.hideBottomSheet();
          this.$router.showDialog('Position Accuracy', `<div class="kai-list-nav"><span class="sr-only">Position accuracy is ${location.coords.accuracy.toFixed(2)}m. Press Left key to cancel. Press Right Key to share location.</span><span aria-hidden="true">Position accuracy is ${location.coords.accuracy.toFixed(2)}m</span></div>`, null, 'SHARE', () => {
            var picker = new MozActivity({
              name: "pick",
              data: {
                type: ["webcontacts/contact"],
                fullContact: "true",
              }
            });
            picker.onsuccess = (result) => {
              const contact = result.target.result.contact;
              if (contact) {
                console.log(contact.name[0], contact.tel[0].value);
                this.$router.showDialog('Confirmation', `<div class="kai-list-nav"><span class="sr-only">Share your location to ${contact.name[0]}, phone number is ${contact.tel[0].value}. Press Left key to cancel. Press Right Key to continue.</span><span aria-hidden="true">Share your location to ${contact.name[0]}, phone number is ${contact.tel[0].value}</span></div>`, null, 'Continue', () => {
                  var sms = new MozActivity({
                    name: "new",
                    data: {
                      type: "websms/sms",
                      body: `https://www.google.com/maps/place/${location.coords.latitude},${location.coords.longitude}`,
                      number: contact.tel[0].value
                    }
                  });
                }, 'Cancel', () => {}, ' ', () => {}, () => {});
              } else {
                this.$router.showDialog('Error', `<div class="kai-list-nav"><span class="sr-only">Operation cancelled. Press Left key to close.</span><span aria-hidden="true">Operation cancelled</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
              }
            }
            picker.onerror = (err) => {
              this.$router.showDialog('Error', `<div class="kai-list-nav"><span class="sr-only">Operation cancelled. Press Left key to close.</span><span aria-hidden="true">Operation cancelled</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
            }
          }, 'Cancel', () => {}, ' ', () => {}, () => {});
        })
        .catch((e) => {
          this.$router.hideBottomSheet();
          this.$router.showDialog('Error', `<div class="kai-list-nav"><span class="sr-only">${e.message}. Press Left key to close.</span><span aria-hidden="true">${e.message}</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
        })
        .finally(() => {
          this.$router.hideLoading();
        });
      },
      gotoCheckIn: function() {
        this.$router.push('checkIn');
      }
    },
    softKeyText: { left: '', center: 'SELECT', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          listNav[this.verticalNavIndex].click();
        }
      },
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowRight: function() {
        // this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      },
      arrowLeft: function() {
        // this.navigateTabNav(1);
      },
    }
  });

  const checkIn = new Kai({
    name: 'checkIn',
    data: {
      title: 'checkIn',
      locations: [],
      total: 0,
      coords: {}
    },
    verticalNavClass: '.checkInNav',
    components: [],
    templateUrl: document.location.origin + '/templates/checkIn.html',
    mounted: function() {
      //this.$router.setHeaderTitle('Check-In History');
      localforage.getItem('__locations__')
      .then((__locations__) => {
        if (__locations__ == null) {
          __locations__ = [];
        }
        this.setData({
          locations: __locations__,
          total: __locations__.length,
        });
      });
      document.addEventListener('keydown', this.methods.listenCallButton);
    },
    unmounted: function() {
      document.removeEventListener('keydown', this.methods.listenCallButton);
    },
    methods: {
      listenCallButton: function(evt) {
        if (this.$router.bottomSheet)
          return
        if (evt.key == 'Call') {
          this.$router.showDialog('Notice', `<div class="kai-list-nav"><span class="sr-only">Please wait.</span><span aria-hidden="true">Please wait</span></div>`, null, ' ', () => {}, ' ', () => {}, ' ', () => {}, () => {});
          this.$router.showLoading();
          getMyLocation(true)
          .then((location) => {
            this.data.coords = {latitude: location.coords.latitude, longitude: location.coords.longitude};
            console.log(location.coords.accuracy, location.coords.latitude, location.coords.longitude);
            this.$router.hideBottomSheet();
            this.$router.showDialog('Position Accuracy', `<div class="kai-list-nav"><span class="sr-only">Position accuracy is ${location.coords.accuracy.toFixed(2)}m. Press Left key to cancel. Press Right Key to continue.</span><span aria-hidden="true">Position accuracy is ${location.coords.accuracy.toFixed(2)}m</span></div>`, null, 'Continue', () => {
              this.methods.checkInLocation();
            }, 'Cancel', () => {}, ' ', () => {}, () => {});
          })
          .catch((e) => {
            this.$router.hideBottomSheet();
            this.$router.showDialog('Error', `<div class="kai-list-nav"><span class="sr-only">${e.message}. Press Left key to close.</span><span aria-hidden="true">${e.message}</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
          })
          .finally(() => {
            this.$router.hideLoading();
          });
        }
      },
      checkInLocation: function() {
        const nameDialog = Kai.createDialog('Location Name', '<label class="sr-only" for="location-name">Enter your current location name. Left Key to Cancel. Right Key to Save. Call Button to listen for your input text.</label><div><input id="location-name" name="location-name" placeholder="Your current location name" class="kui-input" type="text" /></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
        nameDialog.mounted = () => {
          setTimeout(() => {
            setTimeout(() => {
              this.$router.setSoftKeyText('Cancel' , '', 'OK');
              LOC_INPUT.focus();
            }, 103);
            const LOC_INPUT = document.getElementById('location-name');
            if (!LOC_INPUT) {
              return;
            }
            LOC_INPUT.focus();
            LOC_INPUT.addEventListener('keydown', (evt) => {
              switch (evt.key) {
                case 'Call':
                  if (LOC_INPUT.value || LOC_INPUT.value !== '') {
                    pushLocalNotification(`Input value is ${LOC_INPUT.value}`);
                  }
                  break
                case 'Backspace':
                case 'EndCall':
                  if (document.activeElement.value.length === 0) {
                    this.$router.hideBottomSheet();
                    setTimeout(() => {
                      this.methods.renderSoftKey();
                      LOC_INPUT.blur();
                    }, 100);
                  }
                  break
                case 'SoftRight':
                  console.log(this.data.coords);
                  if (LOC_INPUT.value == '') {
                    pushLocalNotification('Please enter location name');
                    return
                  }
                  this.$router.showLoading();
                  localforage.getItem('__locations__')
                  .then((__locations__) => {
                    if (__locations__ == null) {
                      __locations__ = [];
                    }
                    var data = JSON.parse(JSON.stringify(this.data.coords));
                    data['name'] = LOC_INPUT.value;
                    __locations__.push(data);
                    return localforage.setItem('__locations__', __locations__)
                    .then(() => {
                      return localforage.getItem('__locations__');
                    })
                  })
                  .then((__locations__) => {
                    if (__locations__ == null) {
                      __locations__ = [];
                    }
                    pushLocalNotification('Done');
                    setTimeout(() => {
                      this.$router.hideLoading();
                      this.$router.hideBottomSheet();
                      LOC_INPUT.blur();
                      this.setData({
                        locations: __locations__,
                        total: __locations__.length,
                      });
                      this.methods.renderSoftKey();
                    }, 2000);
                  });
                  break
                case 'SoftLeft':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    this.methods.renderSoftKey();
                    LOC_INPUT.blur();
                  }, 100);
                  break
              }
            });
          });
        }
        nameDialog.dPadNavListener = {
          arrowUp: function() {
            const LOC_INPUT = document.getElementById('location-name');
            LOC_INPUT.focus();
          },
          arrowDown: function() {
            const LOC_INPUT = document.getElementById('location-name');
            LOC_INPUT.focus();
          }
        }
        this.$router.showBottomSheet(nameDialog);
      },
      removeLocation: function(idx) {
        this.data.locations.splice(idx, 1);
        localforage.setItem('__locations__', this.data.locations)
        .then(() => {
          return localforage.getItem('__locations__');
        })
        .then((__locations__) => {
          if (__locations__ == null) {
            __locations__ = [];
          }
          if (idx === __locations__.length) {
            const LIS = document.querySelectorAll(this.verticalNavClass);
            const old = LIS[this.verticalNavIndex];
            if (old) {
              old.classList.remove("focus");
            }
            this.verticalNavIndex -= 1;
          }
          pushLocalNotification('Done');
          setTimeout(() => {
            this.setData({
              locations: __locations__,
              total: __locations__.length,
            });
          }, 2000);
        })
      },
      renderSoftKey: function() {
        const idx = this.verticalNavIndex - 1;
        const location = this.data.locations[idx];
        if (location) {
          this.$router.setSoftKeyText('Search', '', 'More');
        } else {
          this.$router.setSoftKeyText('Search', '', '');
        }
      }
    },
    softKeyText: { left: 'Search', center: '', right: '' },
    softKeyListener: {
      left: function() {
        const searchDialog = Kai.createDialog('Search Location', '<label class="sr-only" for="search-name">Enter location name or leave it blank to reset search. Left Key to Cancel. Right Key to Search. Call Button to listen for your input text.</label><div><input id="search-name" name="search-name" placeholder="Enter location name" class="kui-input" type="text" /></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
        searchDialog.mounted = () => {
          setTimeout(() => {
            setTimeout(() => {
              this.$router.setSoftKeyText('Cancel' , '', 'Search');
              SEARCH_INPUT.focus();
            }, 103);
            const SEARCH_INPUT = document.getElementById('search-name');
            if (!SEARCH_INPUT) {
              return;
            }
            SEARCH_INPUT.focus();
            SEARCH_INPUT.addEventListener('keydown', (evt) => {
              switch (evt.key) {
                case 'Call':
                  if (SEARCH_INPUT.value || SEARCH_INPUT.value !== '') {
                    pushLocalNotification(`Input value is ${SEARCH_INPUT.value}`);
                  }
                  break
                case 'Backspace':
                case 'EndCall':
                  if (document.activeElement.value.length === 0) {
                    this.$router.hideBottomSheet();
                    setTimeout(() => {
                      this.methods.renderSoftKey();
                      SEARCH_INPUT.blur();
                    }, 100);
                  }
                  break
                case 'SoftRight':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    this.verticalNavIndex = 0;
                    this.setData({
                      locations: [],
                      total: 0,
                    });
                    SEARCH_INPUT.value
                    localforage.getItem('__locations__')
                    .then((__locations__) => {
                      if (__locations__ == null) {
                        __locations__ = [];
                      }
                      var results = [];
                      __locations__.forEach((loc) => {
                        if (loc.name.toLowerCase().indexOf(SEARCH_INPUT.value.toLowerCase()) > -1 || !SEARCH_INPUT.value || SEARCH_INPUT.value == '') {
                          results.push(loc);
                        }
                      });
                      console.log(results);
                      this.setData({
                        locations: results,
                        total: results.length,
                      });
                      this.verticalNavIndex = -1;
                      this.navigateListNav(1);
                    });
                    SEARCH_INPUT.blur();
                  }, 100);
                  break
                case 'SoftLeft':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    this.methods.renderSoftKey();
                    SEARCH_INPUT.blur();
                  }, 100);
                  break
              }
            });
          });
        }
        searchDialog.dPadNavListener = {
          arrowUp: function() {
            const SEARCH_INPUT = document.getElementById('search-name');
            SEARCH_INPUT.focus();
          },
          arrowDown: function() {
            const SEARCH_INPUT = document.getElementById('search-name');
            SEARCH_INPUT.focus();
          }
        }
        this.$router.showBottomSheet(searchDialog);
      },
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          listNav[this.verticalNavIndex].click();
        }
      },
      right: function() {
        const idx = this.verticalNavIndex - 1;
        const location = this.data.locations[idx];
        if (location) {
          var menus = [
            { "text": "Open in Google Map" },
            { "text": "Generate Google Map QR Code" },
            { "text": "Distance from my location" },
            { "text": "Share this location" },
            { "text": "Remove this location" },
          ];
          this.$router.showOptionMenu('More', menus, 'Select', (selected) => {
              if (selected.text === 'Remove this location') {
                this.$router.showDialog('Remove Location', `<div class="kai-list-nav"><span class="sr-only">Are you sure to remove ${location.name} ?. Press Left key to cancel. Press Right Key to continue.</span><span aria-hidden="true">Are you sure to remove ${location.name} ?</span></div>`, null, 'Continue', () => {
                  this.methods.removeLocation(idx);
                }, 'Cancel', () => {}, ' ', () => {}, () => {});
              } else if (selected.text === 'Share this location') {
                var picker = new MozActivity({
                  name: "pick",
                  data: {
                    type: ["webcontacts/contact"],
                    fullContact: "true",
                  }
                });
                picker.onsuccess = (result) => {
                  const contact = result.target.result.contact;
                  if (contact) {
                    console.log(contact.name[0], contact.tel[0].value);
                    this.$router.showDialog('Confirmation', `<div class="kai-list-nav"><span class="sr-only">Share ${location.name} to ${contact.name[0]}, phone number is ${contact.tel[0].value}. Press Left key to cancel. Press Right Key to continue.</span><span aria-hidden="true">Share ${location.name} to ${contact.name[0]}, phone number is ${contact.tel[0].value}</span></div>`, null, 'Continue', () => {
                      var sms = new MozActivity({
                        name: "new",
                        data: {
                          type: "websms/sms",
                          body: `https://www.google.com/maps/place/${location.latitude},${location.longitude}`,
                          number: contact.tel[0].value
                        }
                      });
                    }, 'Cancel', () => {}, ' ', () => {}, () => {});
                  } else {
                    this.$router.showDialog('Error', `<div class="kai-list-nav"><span class="sr-only">Operation cancelled. Press Left key to close.</span><span aria-hidden="true">Operation cancelled</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
                  }
                }
                picker.onerror = (err) => {
                  this.$router.showDialog('Error', `<div class="kai-list-nav"><span class="sr-only">Operation cancelled. Press Left key to close.</span><span aria-hidden="true">Operation cancelled</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
                }
              } else if (selected.text === 'Distance from my location') {
                this.$router.showDialog('Notice', `<div class="kai-list-nav"><span class="sr-only">Please wait.</span><span aria-hidden="true">Please wait</span></div>`, null, ' ', () => {}, ' ', () => {}, ' ', () => {}, () => {});
                this.$router.showLoading();
                getMyLocation(true)
                .then((_location) => {
                  var dis = distVincenty(_location.coords.latitude, _location.coords.longitude, location.latitude, location.longitude);
                  if (dis > 1000) {
                    dis = `${(parseFloat(dis)/1000).toFixed(2).toString()}km`;
                  } else {
                    dis = `${parseFloat(dis).toFixed(2).toString()}m`;
                  }
                  console.log(_location.coords.accuracy, _location.coords.latitude, _location.coords.longitude);
                  this.$router.hideBottomSheet();
                  this.$router.showDialog('Distance', `<div class="kai-list-nav"><span class="sr-only">Position accuracy is ${_location.coords.accuracy.toFixed(2)}m. Your distance from ${location.name} is ${dis}. Press Left key to close.</span><span aria-hidden="true">Position accuracy is ${_location.coords.accuracy.toFixed(2)}m. Your distance from ${location.name} is ${dis}</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
                })
                .catch((e) => {
                  this.$router.hideBottomSheet();
                  this.$router.showDialog('Error', `<div class="kai-list-nav"><span class="sr-only">${e.message}. Press Left key to close.</span><span aria-hidden="true">${e.message}</span></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
                })
                .finally(() => {
                  this.$router.hideLoading();
                });
              } else if (selected.text === 'Generate Google Map QR Code') {
                this.$router.showDialog('QR CODE', `<div class="kai-list-nav"><span class="sr-only">${location.name} QR Code is ready. Press Left key to close.</span><div id="qrcode" aria-hidden="true" style="margin-left:25px;"></div></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {});
                setTimeout(() => {
                  new QRCode(document.getElementById("qrcode"), {
                    text: `https://www.google.com/maps/place/${location.latitude},${location.longitude}`,
                    width: 180,
                    height: 180,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                  });
                }, 100);
              } else if (selected.text === 'Open in Google Map') {
                window.open(`https://www.google.com/maps/place/${location.latitude},${location.longitude}`);
              }
          }, () => {});
        }
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
        this.methods.renderSoftKey();
      },
      arrowRight: function() {
        // this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
        this.methods.renderSoftKey();
      },
      arrowLeft: function() {
        // this.navigateTabNav(1);
      },
    }
  });

  const homescreen = new Kai({
    name: 'homescreen',
    data: {
      title: 'homescreen',
      opts: []
    },
    verticalNavClass: '.homeNav',
    components: [],
    templateUrl: document.location.origin + '/templates/home.html',
    mounted: function() {
      this.$router.setHeaderTitle('Accessibility Suite');
    },
    unmounted: function() {
      this.verticalNavIndex = -1;
    },
    methods: {
      goToScreen: function(name) {
        this.$router.push(name);
      },
      exitApp: function() {
        pushLocalNotification(`App was closed`);
        window.close();
      }
    },
    softKeyText: { left: '', center: 'SELECT', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          listNav[this.verticalNavIndex].click();
        }
      },
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowRight: function() {
        // this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      },
      arrowLeft: function() {
        // this.navigateTabNav(1);
      },
    },
    backKeyListener: function() {
      if (document.activeElement) {
        document.activeElement.classList.remove('focus');
        this.verticalNavIndex = -1;
      }
    }
  });

  const router = new KaiRouter({
    title: 'Accessibility Suite',
    routes: {
      'index' : {
        name: 'homescreen',
        component: homescreen
      },
      'battery' : {
        name: 'battery',
        component: battery
      },
      'dateTime' : {
        name: 'dateTime',
        component: dateTime
      },
      'weather' : {
        name: 'weather',
        component: weather
      },
      'geolocation' : {
        name: 'geolocation',
        component: geolocation
      },
      'checkIn' : {
        name: 'checkIn',
        component: checkIn
      },
    }
  });

  const app = new Kai({
    name: '_APP_',
    data: {},
    templateUrl: document.location.origin + '/templates/template.html',
    mounted: function() {},
    unmounted: function() {},
    router,
    state
  });

  try {
    app.mount('app');
  } catch(e) {
    console.log(e);
  }

  function displayKaiAds() {
    var display = true;
    if (window['kaiadstimer'] == null) {
      window['kaiadstimer'] = new Date();
    } else {
      var now = new Date();
      if ((now - window['kaiadstimer']) < 300000) {
        display = false;
      } else {
        window['kaiadstimer'] = now;
      }
    }
    console.log('Display Ads:', display);
    if (!display)
      return;
    getKaiAd({
      publisher: 'ac3140f7-08d6-46d9-aa6f-d861720fba66',
      app: 'accessibility-suite',
      slot: 'kaios',
      onerror: err => console.error(err),
      onready: ad => {
        if (document.activeElement) {
          document.activeElement.classList.remove('focus');
        }
        ad.call('display');
        ad.on('close', () => {
          document.body.style.position = '';
          const screen = app.$router.stack[app.$router.stack.length - 1];
          if (screen) {
            screen.verticalNavIndex = -1;
            setTimeout(() => {
              screen.navigateListNav(1);
            }, 200);
          }
        });
        ad.on('display', () => {
          document.body.style.position = '';
          pushLocalNotification('Ads was displayed. press Left key to close');
        });
      }
    })
  }

  displayKaiAds();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      
    } else if (document.visibilityState === 'visible') {
      const main = app.$router.stack[app.$router.stack.length - 1];
      if (main.name === 'homescreen') {
        if (main.verticalNavIndex === -1) {
          main.navigateListNav(1);
          displayKaiAds();
        }
      }
    }
  })
});
