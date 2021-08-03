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

//getMyLocation()
//.then((pos) => {
  //return getWeatherForecast(pos.latitude, pos.longitude);
//})
//.then((forecast) => {
  //console.log(forecast);
//})
//.catch((err) => {
  //console.log(err);
//})

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
    'counter': -1,
    'editor': '',
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
    mounted: function() {},
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
    mounted: function() {},
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

  const homescreen = new Kai({
    name: 'homescreen',
    data: {
      title: 'homescreen',
      opts: []
    },
    verticalNavClass: '.homeNav',
    components: [],
    templateUrl: document.location.origin + '/templates/home.html',
    mounted: function() {},
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

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      
    } else if (document.visibilityState === 'visible') {
      const main = app.$router.stack[app.$router.stack.length - 1];
      if (main.name === 'homescreen') {
        if (main.verticalNavIndex === -1) {
          main.navigateListNav(1);
        }
      }
    }
  })
});
