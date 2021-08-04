const getMyLocation = function() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition((location) => {
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
      this.$router.setHeaderTitle('Battery Info');
    },
    unmounted: function() {},
    methods: {
      getBatteryInfo: function(type) {
        if (type === 1) {
          pushLocalNotification(`Battery level is ${(navigator.battery.level* 100).toFixed()}%`)
        } else if (type === 2) {
          pushLocalNotification(`Battery is ${navigator.battery.charging ? 'charging' : 'not charging'}`)
        } else if (type === 3) {
          pushLocalNotification(`Battery temperature is ${navigator.battery.temperature.toFixed()} degree celcius`)
        } else if (type === 4) {
          pushLocalNotification(`Battery status is ${navigator.battery.health}`)
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
      this.$router.setHeaderTitle('Date and Time Info');
    },
    unmounted: function() {},
    methods: {
      getCurrentTime: function(type) {
        if (type === 1) {
          pushLocalNotification(`Current time is ${new Date().toLocaleTimeString()}`);
        } else if (type === 2) {
          pushLocalNotification(`Current date is ${new Date().toDateString()}`);
        } else if (type === 3) {
          const d = new Date();
          const full = `${d.toLocaleTimeString()}, ${d.toDateString()}`;
          pushLocalNotification(`Current time and date are ${full}`);
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
          'screen_reader': 'Please wait while we getting a weather forcast,',
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
              'screen_reader': `Weather Forcast for ${forecast.title}. Use Arrow Up and Arrow Down button to navigate the menu or press Back to return,`,
              'text': `Weather Forcast`,
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
            }, 1000);
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
      // displayKaiAds();
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
        ad.call('display');
        ad.on('close', () => {
          const screen = app.$router.stack[app.$router.stack.length - 1];
          if (document.activeElement && screen) {
            document.activeElement.classList.remove('focus');
            screen.verticalNavIndex = -1;
            setTimeout(() => {
              screen.navigateListNav(1);
            }, 200);
          }
        });
        pushLocalNotification('Ads was displayed, press Left key to close');
        setTimeout(() => {
          document.body.style.position = '';
        }, 1000);
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
