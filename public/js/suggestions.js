var suggestions = function(){
    return {
        defaultOptions:{
            deferTableUpdatesAtRows: 5000,
            keepRunning: false,
            maxQueueDisplay: 5000,
            country: "de",
            filterNegative: "",
            filterPositive: "",
            lang: "de",
            prefixes: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "wer", "wen", "wem", "wessen", "was", "wo", "wohin", "woher", "wann", "wie lange", "wie oft", "seit wann", "bis wann", "wie", "wie viel", "wie viele", "warum", "wieso", "weshalb", "weswegen", "wozu", "wofür", "welcher", "welche", "welches", "was für ein", "was für eine", "woran", "worauf", "woraus", "wobei", "wodurch", "worein", "wogegen", "wohinter", "worin", "womit", "wonach", "worüber", "worum", "worunter", "wovon", "wovor", "wozwischen"],
            rateLimit: 750,
            service: "google",
            suffixes: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "kaufen", "online", "test", "preis", "vergleich", "günstig", "ohne", "mit", "für", "in der nähe", "wie", "ähnlich", "gegen", "versus", "vs", "zu", "nach", "außer", "hat"]
        },

        services:{
            "google":
            "//suggestqueries.google.com/complete/search?client=chrome&hl=${lang}&gl=${country}&callback=?&q=",
            "google news":
            "//suggestqueries.google.com/complete/search?client=chrome&hl=${lang}&ds=n&gl=${country}&callback=?&q=",
            "google shopping":
            "//suggestqueries.google.com/complete/search?client=chrome&hl=${lang}&ds=sh&gl=${country}&callback=?&q=",
            "youtube":
            "//suggestqueries.google.com/complete/search?client=chrome&hl=${lang}&ds=yt&gl=${country}&callback=?&q=",
            "google images":
            "//suggestqueries.google.com/complete/search?client=chrome&hl=${lang}&ds=i&gl=${country}&callback=?&q=",
            "yahoo":
            "//search.yahoo.com/sugg/ff?output=jsonp&appid=ffd&callback=?&command=",
            "bing": "//api.bing.com/osjson.aspx?JsonType=callback&JsonCallback=?&query=",
            "google ads ideas": "api/ideas",
        },
        getUrl :function(service, options){
            options = _.defaults({},this.defaultOptions, this.getOptions(), options)
            return _.template(this.services[(service||this.options.service)])(options);
        },


        parseServiceResponse: function(res, service){
            RESPONSE_TEMPLATES = {
                "default": function (res) {
                    return res[1];
                },
                "yahoo": function (res) {
                    return _.map(res.gossip.results, 'key');
                },
                "linkedin": function(res){
                    return _.map(res.resultList,'displayName');
                },
            };
            var parser = RESPONSE_TEMPLATES[(service||this.options.service)] || RESPONSE_TEMPLATES["default"];
            return parser(res);
        }
    }
}()
