var IDEAS_SERVICE = 'google ads ideas';

var KWS = function(){

    return {
        table: undefined,
        myIp: undefined,
        options: {},
        queryLock: false,
        doWork: false,
        hashMapInputs: {},
        keywordsToQuery: [],
        keywordsToQueryIndex: 0,
        numOfInitialKeywords: 0,
        generation: 0,
        ideasMode: false,
        progressActive: false,
        suggestRound: 1,
        continuing: false,
        round: 1,
        ideaRows: {},

        services:suggestions.services,
        getUrl :suggestions.getUrl,
        parseServiceResponse: suggestions.parseServiceResponse,

        exportColumns: function(withSeries){
            var idx = [];
            this.table.columns().every(function(i){ if (i !== 16 && i !== 19 && this.visible()) idx.push(i); });
            if (withSeries) { idx.push(19); idx.push(16); }
            return idx;
        },
        lastSeed: null,
        exportFilename: function(){
            var seed = this.lastSeed || _.find(_.map(String($('#input').val() || '').split('\n'), _.trim), function(l){ return l.length; }) || 'keywords';
            var slug = String(seed).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'keywords';
            var d = new Date(), p2 = function(n){ return (n < 10 ? '0' : '') + n; };
            return slug + '-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
        },

        toggleWork: function(){
            if (this.doWork === false)
                this.StartWork();
            else
                this.StopWork();
        },

        StartWork: function() {
            if (this.doWork === false && $('#service').val() === IDEAS_SERVICE && !this.ideaSeeds().length) {
                $('#volume-status').text('Google Ads ideas: enter at least one seed keyword in the input field.');
                return;
            }
            if (this.doWork === false) {
                if (!this.continuing) this.suggestRound = 1;
                this.continuing = false;
                this.saveSettings();
                $('#startjob').val('Stop Job').text('Stop doing').addClass('btn-danger');
                this.hashMapInputs = {};
                this.keywordsToQuery = [];
                this.keywordsToQueryIndex = 0;

                this.hashMapInputs[""] = true;
                this.hashMapInputs[" "] = true;
                this.hashMapInputs["  "] = true;

                this.options = this.getOptions();

                var ks = $('#input').val().split("\n");
                this.keywordsToQuery=_.uniq(_.filter(_.map(ks,this.CleanVal), function(k){return k.trim().length;}));
                this.lastSeed = this.keywordsToQuery[0] || null;

                this.ideasMode = this.options.service === IDEAS_SERVICE;
                this.ideasMore = false;
                if (this.ideasMode) {
                    var self = this;
                    this.keywordsToQuery = _.filter(this.keywordsToQuery, function(k){return k.trim().length;});
                    this.keywordsToQuery.forEach(function(k){ self.hashMapInputs[k.trim()] = true; });
                    this.round = 1;
                    this.ideaRows = {};
                    this.table.rows().data().each(function(d){ self.ideaRows[d.keyword.trim()] = true; });
                    $('#volume-status').text('Google Ads ideas: round 1...');
                }

                if (this.ideasMode) {
                } else if (!this.keywordsToQuery.length)
                    this.permuteResultsToQueue([' ']);
                else {
                    var untickedInputs = this.keywordsToQuery.filter(function(k){
                        return k.slice(-1)!=='✓' && k.slice(-1)!=='❌';
                    });
                    this.permuteResultsToQueue(untickedInputs);
                }

                this.numOfInitialKeywords = this.keywordsToQuery.length;
                this.FilterAndDisplay();

                this.doWork = true;
                if (!this.progressActive) { this.progressActive = true; this.progress1.start(); }


            } else {

            }
        },

        setProgress: function(percent){
            if (!this.progressActive) return;
            var inner = document.querySelector('.progressjs-inner');
            if (this.options && this.options.keepRunning) {
                if (inner) inner.classList.add('mai-indeterminate');
                return;
            }
            if (inner) inner.classList.remove('mai-indeterminate');
            this.progress1.set(percent);
        },

        StopWork: function(keepProgress){
            if (this.doWork){
                $('#startjob').val('Start Job').text('Start doing').removeClass('btn-danger');
                this.doWork = false;
                this.table.draw();
                this.table.columns.adjust();
                this.saveSettings();
                this.FilterAndDisplay();
                if (!keepProgress && this.progressActive) { this.progressActive = false; this.progress1.end(); }
            }
        },

        DoJob: function() {
            if (this.doWork === true && this.ideasMode) return this.DoIdeasJob();
            if (this.doWork === true && this.queryLock === false) {
                if (this.keywordsToQueryIndex < this.numOfInitialKeywords) {
                    var currentKw = this.keywordsToQuery[this.keywordsToQueryIndex];
                    if (currentKw.slice(-1)!=='✓' && currentKw.slice(-1)!=='❌') {
                        this.QueryKeyword(currentKw);
                        this.keywordsToQueryIndex++;
                    } else {
                        this.keywordsToQueryIndex++;
                        this.DoJob();
                    }

                    var prog = parseInt(this.keywordsToQueryIndex/this.numOfInitialKeywords*100);
                    this.setProgress(prog);
                    this.FilterAndDisplay();

                } else {
                    if (this.options.keepRunning) {
                        console.log('finish initial queue');
                        this.StopWork(true);
                        this.continuing = true;
                        this.suggestRound++;
                        this.StartWork();
                    } else {
                        console.log('finish initial queue');
                        this.StopWork();
                    }
                }
            }
        },

        ideaLimits: function(){
            return {
                rounds: Math.max(1, parseInt($('#ideas-max-rounds').val()) || 2),
                maxKw: Math.max(1, parseInt($('#ideas-max-keywords').val()) || 5000),
                minVol: Math.max(0, parseInt($('#ideas-min-volume').val()) || 0)
            };
        },

        ideaSeeds: function(){
            return _.filter(_.map($('#input').val().split('\n'), this.CleanVal), function(k){
                return k.trim().length && k.slice(-1)!=='✓' && k.slice(-1)!=='❌';
            });
        },

        finishIdeas: function(msg){
            this.StopWork();
            $('#volume-status').text(msg);
        },

        countIdeaRows: function(){
            var self = this;
            return _.filter(this.table.rows().data().toArray(), function(r){ return self.passesFilter(r.keyword); }).length;
        },
        ideasMore: false,
        ideasMoreNote: function(){ return this.ideasMore ? ' Google has more ideas for these seeds than the 1000 per request that are returned.' : ''; },

        DoIdeasJob: function(){
            if (!this.doWork || this.queryLock) return;
            var maxKw = this.ideaLimits().maxKw;
            if (this.countIdeaRows() >= maxKw)
                return this.finishIdeas('Google Ads ideas: stopped at ' + maxKw + ' results.' + this.ideasMoreNote());

            var batch = [], idxs = [];
            while (this.keywordsToQueryIndex < this.numOfInitialKeywords && batch.length < 20) {
                var kw = this.keywordsToQuery[this.keywordsToQueryIndex];
                if (kw.slice(-1)!=='✓' && kw.slice(-1)!=='❌') { batch.push(kw.trim()); idxs.push(this.keywordsToQueryIndex); }
                this.keywordsToQueryIndex++;
            }
            if (batch.length) {
                this.QueryIdeas(batch, idxs);
                this.setProgress(parseInt(this.keywordsToQueryIndex/this.numOfInitialKeywords*100));
                this.FilterAndDisplay();
                return;
            }

            var maxRounds = this.ideaLimits().rounds;
            if (this.options.keepRunning && this.round < maxRounds && this.keywordsToQuery.length > this.numOfInitialKeywords) {
                this.round++;
                this.numOfInitialKeywords = this.keywordsToQuery.length;
                $('#volume-status').text('Google Ads ideas: round ' + this.round + ' of max ' + maxRounds + '...');
                return;
            }
            this.finishIdeas('Google Ads ideas finished: ' + this.countIdeaRows() + ' results.' + this.ideasMoreNote());
        },

        QueryIdeas: function(batch, idxs){
            var self = this;
            this.queryLock = true;
            var gen = this.generation;
            $.ajax({
                url: 'api/ideas',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({keywords: batch, country: $('#country').val(), lang: $('#lang').val()})
            }).done(function(res){
                if (gen !== self.generation) return;
                var order = res.order || [], results = res.results || {};
                var lim = self.ideaLimits(), maxKw = lim.maxKw, minVol = lim.minVol;
                var remaining = maxKw - self.countIdeaRows();
                if (res.more) self.ideasMore = true;

                var fresh = [];
                for (var i = 0; i < order.length; i++) {
                    var k = order[i];
                    if (self.ideaRows[k]) continue;
                    if (self.passesFilter(k)) {
                        if (remaining <= 0) break;
                        remaining--;
                    }
                    self.ideaRows[k] = true;
                    fresh.push(k);
                }
                var search = batch.length === 1 ? batch[0] : batch[0] + ' +' + (batch.length - 1);
                if (fresh.length) {
                    self.displayResults(fresh, search, undefined, 'https://ads.google.com/keywordplanner/ideas');
                    self.applyVolume(results);
                    if (self.options.keepRunning)
                        self.addResultsToQueue(_.filter(fresh, function(k){ return results[k] && results[k].volume >= minVol; }));
                }
                _.each(idxs, function(ix){ self.keywordsToQuery[ix] += order.length ? ' ✓' : ' ❌'; });
                $('#volume-status').text('Google Ads ideas: round ' + self.round + ', ' + self.countIdeaRows() + ' results...');
                self.queryLock = false;
            }).fail(function(xhr){
                if (gen !== self.generation) return;
                var msg = (xhr.responseJSON && xhr.responseJSON.error) ||
                    (xhr.status === 404 || xhr.status === 405 ? 'backend not running (start with: npm start)' : 'request failed');
                self.queryLock = false;
                var oi = self.explainAds(xhr, 'Do Keywords!');
                oi.progress = self.table.rows().count() + ' results found before the stop (they are in the table).';
                self.showAlert(oi.level, oi);
                self.finishIdeas('Google Ads ideas error: ' + msg);
            });
        },

        addResultsToQueue: function(retList, search){
            retList=_.map(retList,this.CleanVal);

            for (var j = 0; j < retList.length; j++) {
                cleanKw = retList[j];
                if (cleanKw && cleanKw.length && !this.hashMapInputs[cleanKw] && !this.isExcluded(cleanKw) && this.keywordsToQuery.indexOf(cleanKw)===-1)
                    this.keywordsToQuery.push(cleanKw);
                this.hashMapInputs[cleanKw] = true;
            }

        },

        permuteResultsToQueue: function(retList, search){
            var chr, currentx, currentKw;
            var self = this;
            var options = this.getOptions()

            this.hashMapInputs[search] = true;


            function addPrefix(s,prefix){
                return prefix+' '+s;
            }
            function addSuffix(s,suffix){
                return s+' '+suffix;
            }
            retList=_.map(retList,this.CleanVal);

            var newInputs = retList.reduce(function(result, keyword){
                return _.concat(
                    result,
                    _.map(options.prefixes,addPrefix.bind(self,keyword)),
                    _.map(options.suffixes,addSuffix.bind(self,keyword))
                );
            }, []);

            newInputs = _.reject(newInputs, function(k){return self.isExcluded(k);});
            this.keywordsToQuery=_.concat(this.keywordsToQuery,newInputs);

            return newInputs;
        },


        displayResults: function(retList, search, dontDisplay, url,data){

            var rows=[];
            retList=_.map(retList,this.CleanVal);
            for (var i = 0; i < retList.length; i++) {
                var  cleanKw = retList[i];

                if (url===undefined) url=data[i].url;

                var da = {
                    id: this.table.rows()[0].length+i,
                    keyword: cleanKw,
                    length: cleanKw.length,
                    words: cleanKw.trim().split(/ +/).length,
                    volume: null,
                    cpc: null,
                    competition: null,
                    competitionLevel: null,
                    cpcLow: null,
                    cpcAvg: null,
                    change3m: null,
                    changeYoy: null,
                    change3y: null,
                    question: null,
                    trend: null,
                    brand: null,
                    brandFor: null,
                    concepts: null,
                    conceptNames: null,
                    conceptGroups: null,
                    conceptTypes: null,
                    search: search,
                    domain: this.extractDomain(url)
                };

                da = _.mapValues(da, function(v){return v===undefined ? null: v;});

                rows.push(da);
            }
            this.table.rows.add(rows);
            if (!dontDisplay && this.table.data().length<this.options.deferTableUpdatesAtRows) this.table.draw(false);
        },

        extractDomain: function(url) {
            if (url===undefined) return null;
            var domain;
            if (url.indexOf("://") > -1) {
                domain = url.split('/')[2];
            }
            else {
                domain = url.split('/')[0];
            }

            domain = domain.split(':')[0];

            var mr = url.match('ds=(..?)&');
            if (mr && mr[1] && mr[1].length) domain+='&ds='+mr[1];

            var mr = url.match('gl=(..?)&');
            if (mr && mr[1] && mr[1].length) domain+='&gl='+mr[1];

            var mr = url.match('hl=(..?)&');
            if (mr && mr[1] && mr[1].length) domain+='&hl='+mr[1];

            var mr = url.match('uil=(..?)&');
            if (mr && mr[1] && mr[1].length) domain+='&uil='+mr[1];

            return domain;
        },

        markAsDone: function(search){
            if (this.keywordsToQuery[this.keywordsToQueryIndex]===search)
                this.keywordsToQuery[this.keywordsToQueryIndex]+=' ✓';
            else if (this.keywordsToQuery[this.keywordsToQueryIndex-1]===search)
                this.keywordsToQuery[this.keywordsToQueryIndex-1]+=' ✓';
            else
                console.warn('Cant find ',search,'in keywordsToQuery');
        },

        markAsNone: function(search){
            if (this.keywordsToQuery[this.keywordsToQueryIndex]===search)
                this.keywordsToQuery[this.keywordsToQueryIndex]+=' ❌';
            else if (this.keywordsToQuery[this.keywordsToQueryIndex-1]===search)
                this.keywordsToQuery[this.keywordsToQueryIndex-1]+=' ❌';
            else
                console.warn('Cant find ',search,'in keywordsToQuery');
        },

        QueryKeyword: function(search) {
            var self = this;
            this.queryLock = true;
            var gen = this.generation;

            url = self.getUrl()+search;
            var promise = $.ajax({
                url: url,
                dataType: "jsonp",
                success: function (res, statusText, jqXHR) {
                    if (gen !== self.generation) return;
                    var retList = self.parseServiceResponse(res);
                    if (retList && retList.length){
                        self.displayResults(retList, search, undefined, this.url);
                        self.addResultsToQueue(retList);
                        if (self.options.keepRunning) self.permuteResultsToQueue(retList);
                        self.markAsDone(search);
                    } else {
                        self.markAsNone(search);
                    }
                    self.queryLock = false;
                    return;

                },
                error: function(jqXHR,errorText,error){
                    console.error(errorText,this.url,this,jqXHR,error);
                    if (gen !== self.generation) return;
                    self.queryLock = false;
                    return;
                },
                callback: function(){
                    console.log(this,arguments);
                }
            });
            return promise;
        },

        CleanVal: function(input) {


            input=new DOMParser().parseFromString(String(input), 'text/html').body.textContent;

            input = input.toLowerCase();

            if (input.length > 4 && input.substring(0, 4) == "http") input = "";

            return input;
        },

        filterTerms: {include: [], exclude: []},

        parseTerms: function(text){
            return _.uniq(_.filter(_.map((text || '').split('\n'), function(t){
                return t.trim().toLowerCase();
            })));
        },

        updateFilters: function(){
            this.filterTerms = {
                include: this.parseTerms($('#filter-positive').val()),
                exclude: this.parseTerms($('#filter-negative').val())
            };
            localStorage.filterPositive = $('#filter-positive').val();
            localStorage.filterNegative = $('#filter-negative').val();
            if (this.table) this.table.draw();
        },

        passesFilter: function(keyword){
            var kw = (keyword || '').toLowerCase();
            var f = this.filterTerms;
            if (f.include.length && !_.some(f.include, function(t){return kw.indexOf(t)!==-1;})) return false;
            return !_.some(f.exclude, function(t){return kw.indexOf(t)!==-1;});
        },

        isExcluded: function(keyword){
            var kw = (keyword || '').toLowerCase();
            return _.some(this.filterTerms.exclude, function(t){return kw.indexOf(t)!==-1;});
        },

        questionsRunning: false,
        questionsStop: false,
        runKind: null,
        questionErrorCount: 0,

        qKey: function(k){ return String(k).trim().replace(/\s+/g, ' '); },

        applyQuestions: function(map){
            var self = this, any = false;
            this.table.rows().every(function(){
                var d = this.data();
                var key = self.qKey(d.keyword);
                if (_.has(map, key)) { d.question = map[key]; this.data(d); any = true; }
            });
            if (any) this.table.column('question:name').visible(true);
        },

        logQuestionErrors: function(errors){
            if (!errors || !errors.length) return;
            var $log = $('#questions-log');
            errors.forEach(function(e){
                console.warn('questions:', e);
                $log.append(document.createTextNode(JSON.stringify(e) + '\n'));
            });
            this.questionErrorCount += errors.length;
            $('#questions-errors-count').text(this.questionErrorCount);
            $('#questions-log-box').show();
        },

        setQuestionsRunning: function(running, kind){
            kind = kind || 'questions';
            this.questionsRunning = running;
            this.runKind = running ? kind : null;
            var q = running && kind === 'questions', b = running && kind === 'brands';
            $('#getquestions').text(q ? 'Stop generating' : 'Generate questions')
                .toggleClass('btn-danger', q).toggleClass('btn-default', !q).prop('disabled', b);
            $('#getbrands').text(b ? 'Stop classifying' : 'Classify brands')
                .toggleClass('btn-danger', b).toggleClass('btn-primary', !b).prop('disabled', q);
        },

        liveShown: false,
        liveTimer: null,

        fmtDuration: function(ms){
            var s = Math.max(1, Math.round(ms / 1000));
            if (s < 90) return s + ' s';
            var m = Math.round(s / 60);
            if (m < 90) return m + ' min';
            var h = Math.floor(m / 60), r = m % 60;
            return h + ' h' + (r ? ' ' + r + ' min' : '');
        },
        fmtClock: function(ts){ return new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}); },

        showAlert: function(level, o){
            var $a = $('#llm-alert').empty().attr('class', 'alert alert-' + level).show();
            $('<button type="button" class="close" aria-label="Close">').text('×').on('click', function(){ $a.hide(); }).appendTo($a);
            $('<h4 style="margin-top: 0;">').text(o.title).appendTo($a);
            [['What happened', o.cause], ['How long', o.duration], ['What to do', o.action]].forEach(function(row){
                if (!row[1]) return;
                $('<p>').append($('<strong>').text(row[0] + ': ')).append(document.createTextNode(row[1])).appendTo($a);
            });
            if (o.progress) $('<p>').text(o.progress).appendTo($a);
            if (o.details) $('<details>').append($('<summary>').text('Technical details'))
                .append($('<pre style="white-space: pre-wrap; font-size: 11px; margin-top: 6px;">').text(o.details)).appendTo($a);
            this.liveShown = !!o.live;
            if (!o.live && $a[0].scrollIntoView) $a[0].scrollIntoView({block: 'nearest'});
        },
        clearAlert: function(){ $('#llm-alert').hide().empty(); this.liveShown = false; },

        explainProblem: function(p, ctx){
            var self = this, now = Date.now();
            var resume = 'Press "' + ctx.again + '" again: only the rows that are still missing are sent.';
            var o = {level: 'danger', details: (p.status ? 'HTTP ' + p.status + ': ' : '') + p.message,
                progress: ctx.total ? ctx.done + ' of ' + ctx.total + ' keywords were done before the stop (they are in the table).' : ''};
            var tries = p.exhausted ? ' The server retried ' + p.attempts + ' times, waiting longer each time, and then gave up.' : '';
            switch (p.type) {
            case 'daily_local':
                o.title = 'Daily request limit reached (' + ctx.today + ' of ' + ctx.limit + ' Groq requests used today)';
                o.cause = 'This server counts its Groq requests per UTC day and stops at GROQ_DAILY_LIMIT, so the free quota is never exceeded.';
                o.duration = 'The counter resets at 00:00 UTC, in about ' + self.fmtDuration(p.resetAt - now) + ' (' + self.fmtClock(p.resetAt) + ' your time).';
                o.action = resume + ' If your Groq account still has requests left, raise GROQ_DAILY_LIMIT in the .env file and restart the server (npm start).';
                break;
            case 'daily_groq':
                o.title = 'Groq daily limit reached (' + (p.scope === 'tokens' ? 'tokens' : 'requests') + ' per day)';
                o.cause = 'Groq itself refused the request: the free plan allows a fixed number of ' + (p.scope === 'tokens' ? 'tokens' : 'requests') + ' per day and today\'s quota is used up.';
                o.duration = p.waitMs ? 'Groq says to try again in about ' + self.fmtDuration(p.waitMs) + ' (around ' + self.fmtClock(now + p.waitMs) + ').'
                    : 'The quota resets at 00:00 UTC, in about ' + self.fmtDuration(p.resetAt - now) + ' (' + self.fmtClock(p.resetAt) + ' your time).';
                o.action = 'Wait for the reset, then ' + resume.charAt(0).toLowerCase() + resume.slice(1) + ' A paid Groq plan has higher limits.';
                break;
            case 'rate':
                o.title = 'Groq is rate-limiting requests (HTTP 429)';
                o.cause = 'Groq accepts only a limited number of requests and tokens per minute (free plan: 8,000 tokens per minute).' + tries;
                o.duration = (p.waitMs ? 'Groq asked to wait about ' + self.fmtDuration(p.waitMs) + '. ' : '') + 'Per-minute limits usually clear within 1-2 minutes.';
                o.action = 'Wait 1-2 minutes, then press "' + ctx.again + '" again (only missing rows are sent). If this keeps happening, lower GROQ_BATCH and GROQ_BATCH_BRANDS in .env (smaller requests) and restart the server.';
                break;
            case 'server':
                o.title = 'Groq is not answering properly (' + (p.status ? 'HTTP ' + p.status : 'timeout') + ')';
                o.cause = 'A temporary problem on Groq\'s side, or a request that took too long.' + tries;
                o.duration = 'Usually a few minutes; longer if Groq has an outage.';
                o.action = 'Wait a few minutes, then press "' + ctx.again + '" again (only missing rows are sent). If it fails repeatedly, lower GROQ_BATCH in .env: smaller requests finish faster.';
                break;
            case 'network':
                o.title = 'The server cannot reach Groq';
                o.cause = 'The connection from this computer to api.groq.com failed (internet, VPN, proxy or firewall).' + tries;
                o.duration = 'Until the connection works again. A short outage fixes itself.';
                o.action = 'Check the internet connection, VPN and firewall, then press "' + ctx.again + '" again (only missing rows are sent).';
                break;
            case 'auth':
                o.title = 'Groq rejected the API key (HTTP ' + p.status + ')';
                o.cause = 'GROQ_API_KEY in .env is wrong, revoked, or not allowed to use this model.';
                o.duration = 'This will not fix itself: waiting does not help.';
                o.action = 'Create or copy a valid key at console.groq.com, write it into .env as GROQ_API_KEY=..., restart the server (npm start), reload this page and press "' + ctx.again + '" again.';
                break;
            case 'model':
                o.title = 'The Groq model is not available (HTTP 404)';
                o.cause = 'The model name in GROQ_MODEL / GROQ_MODELS (.env) does not exist or is not enabled for your account.';
                o.duration = 'This will not fix itself.';
                o.action = 'Check the model name in .env (default: openai/gpt-oss-120b), restart the server (npm start) and reload this page.';
                break;
            case 'too_large':
                o.title = 'Request too large for Groq even in the smallest batch (HTTP 413)';
                o.cause = 'A single request is above the size limit of your Groq plan.';
                o.duration = 'Not time-related.';
                o.action = 'Lower GROQ_BATCH and GROQ_BATCH_BRANDS in .env, restart the server, and press "' + ctx.again + '" again. Unusually long keywords can also cause this.';
                break;
            case 'bad_request':
                o.title = 'Groq refused the request (HTTP 400)';
                o.cause = 'The request was rejected as invalid: ' + p.message;
                o.duration = 'This will not fix itself.';
                o.action = 'Open the technical details below and logs/questions-errors.log; the exact message tells which setting is wrong (for example the model or reasoning setting in .env).';
                break;
            default:
                o.title = 'The run stopped because of an error' + (p.status ? ' (HTTP ' + p.status + ')' : '');
                o.cause = p.message;
                o.duration = 'Unknown.';
                o.action = 'Try "' + ctx.again + '" again in a few minutes. If it repeats, check logs/questions-errors.log.';
            }
            return o;
        },

        explainBackend: function(xhr, ctx){
            var status = xhr.status, msg = (xhr.responseJSON && xhr.responseJSON.error) || '';
            var o = {level: 'danger', details: 'HTTP ' + status + (msg ? ': ' + msg : '')};
            if (!status || status === 404 || status === 405 || status === 502 || status === 504) {
                o.title = 'The MAIkeys server is not reachable';
                o.cause = 'This page cannot talk to its Node server: it was stopped or crashed, or the page was opened as a file instead of through the server address.';
                o.duration = 'Until the server is started again.';
                o.action = 'If the table is still on screen, export what you need first (a reload empties it). Then run "npm start" in the project folder and open ' + (/^https?:$/.test(location.protocol) ? location.origin + '/' : 'the address it prints') + ' .';
            } else if (status === 409) {
                o.level = 'warning';
                o.title = 'Another Groq run is already active';
                o.cause = 'The server allows one questions/brands run at a time; another tab or an earlier run is still going.';
                o.duration = 'Until that run finishes, usually within a few minutes.';
                o.action = 'Wait for it to finish, then press "' + ctx.again + '" again.';
            } else if (status === 503) {
                o.title = 'Groq is not configured on the server';
                o.cause = msg || 'GROQ_API_KEY is missing.';
                o.duration = 'Not time-related.';
                o.action = 'Add GROQ_API_KEY=... to the .env file in the project folder, restart the server (npm start) and reload this page.';
            } else {
                o.title = 'The server refused the request (HTTP ' + status + ')';
                o.cause = msg || 'No reason was given.';
                o.duration = 'Unknown.';
                o.action = 'Reload the page and try again. If it repeats, check the server console and logs/questions-errors.log.';
            }
            return o;
        },

        explainAds: function(xhr, what){
            var status = xhr.status, msg = (xhr.responseJSON && xhr.responseJSON.error) || '';
            var o = {level: 'danger', details: 'HTTP ' + status + (msg ? ': ' + msg : '')};
            if (!status || status === 404 || status === 405 || status === 502 || status === 504) return this.explainBackend(xhr, {again: what});
            if (status === 503 && /^Missing env var/i.test(msg)) {
                o.title = 'Google Ads is not configured on the server';
                o.cause = msg || 'Google Ads credentials are missing.';
                o.duration = 'Not time-related.';
                o.action = 'Fill in the Google Ads values in .env (see .env.example), restart the server (npm start) and reload this page.';
            } else if (/^OAuth/i.test(msg) || status === 401 || status === 403) {
                o.title = 'Google rejected the credentials (' + (status === 500 ? 'OAuth' : 'HTTP ' + status) + ')';
                o.cause = 'The OAuth refresh token, client id/secret or customer id in .env is wrong, expired or has no access to the account.';
                o.duration = 'This will not fix itself: waiting does not help.';
                o.action = 'Create a new refresh token, update .env, restart the server (npm start) and press "' + what + '" again.';
            } else if (status === 429) {
                o.title = 'Google Ads is rate-limiting requests (HTTP 429)';
                o.cause = 'Too many requests in a short time, or the daily quota of the Keyword Planner is used up.';
                o.duration = 'A short-term limit usually clears within a few minutes; a daily quota resets the next day.';
                o.action = 'Wait a few minutes and press "' + what + '" again. The rows already loaded stay in the table.';
            } else if (status === 400) {
                o.title = 'Google Ads refused the request (HTTP 400)';
                o.cause = msg || 'The request was rejected as invalid.';
                o.duration = 'This will not fix itself.';
                o.action = 'Check the country/language settings and the keywords (Keyword Planner rejects very long keywords and odd symbols). Details below.';
            } else {
                o.title = 'Google Ads did not answer properly (HTTP ' + status + ')';
                o.cause = msg || 'Temporary problem on Google\'s side.';
                o.duration = 'Usually a few minutes.';
                o.action = 'Wait a few minutes and press "' + what + '" again.';
            }
            return o;
        },

        startLivePoll: function(){
            var self = this;
            this.stopLivePoll();
            var gen = this.generation;
            this.liveTimer = window.setInterval(function(){
                if (gen !== self.generation || !self.questionsRunning) return self.stopLivePoll();
                $.getJSON('api/questions/status').done(function(cfg){
                    if (gen !== self.generation || !self.questionsRunning) return;
                    var w = cfg.live && cfg.live.waiting;
                    if (!w) { if (self.liveShown) self.clearAlert(); return; }
                    var left = self.fmtDuration(Math.max(0, w.until - Date.now()));
                    if (w.kind === 'pacing') {
                        self.showAlert('info', {live: true, title: 'Waiting ' + left + ' (normal, nothing to do)',
                            cause: 'The server pauses between requests to stay within ' + w.reason + '.',
                            duration: 'About ' + left + ' until the next request.',
                            action: 'Nothing: the run continues by itself.'});
                    } else {
                        var why = w.reason === 'rate' ? 'Groq is rate-limiting requests (HTTP 429)'
                            : w.reason === 'network' ? 'the connection to Groq failed'
                            : 'Groq answered with an error' + (w.status ? ' (HTTP ' + w.status + ')' : '');
                        self.showAlert('warning', {live: true, title: 'Groq is busy: retrying automatically',
                            cause: why + '. Attempt ' + w.attempt + ' of ' + w.max + ' failed.',
                            duration: 'Next attempt in about ' + left + '. If all ' + w.max + ' attempts fail, the run stops and tells you what to do.',
                            action: 'Nothing for now: the run continues by itself. Keep this page open.',
                            details: w.message});
                    }
                });
            }, 2000);
        },
        stopLivePoll: function(){ if (this.liveTimer) { window.clearInterval(this.liveTimer); this.liveTimer = null; } },

        generateQuestions: function(){ this.startLLM('questions'); },
        classifyBrands: function(){ this.startLLM('brands'); },

        startLLM: function(kind){
            var self = this;
            var $st = $(kind === 'brands' ? '#brands-status' : '#questions-status');
            var again = kind === 'brands' ? 'Classify brands' : 'Generate questions';
            if (this.questionsRunning) {
                if (this.runKind === kind) { this.questionsStop = true; $st.text('Stopping after the current request...'); }
                return;
            }
            var brand = this.currentBrand();
            var rows = kind === 'brands'
                ? _.filter(this.table.rows().data().toArray(), function(r){ return self.passesFilter(r.keyword); })
                : this.table.rows({search: 'applied'}).data().toArray();
            var todo = _.uniq(_.map(_.filter(rows, function(r){
                return kind === 'brands' ? self.needsBrand(r) : self.needsQuestion(r);
            }), function(r){ return self.qKey(r.keyword); }));
            var total = todo.length;
            this.clearAlert();
            if (!total) {
                $st.text(kind === 'brands' ? 'Nothing to classify: no filtered keywords without a current brand class.'
                    : 'Nothing to generate: no filtered keywords with 2+ words and without a question.');
                return;
            }
            var gen = self.generation;
            self.questionsStop = false;
            self.setQuestionsRunning(true, kind);
            $.getJSON('api/questions/status').done(function(cfg){
                if (gen !== self.generation) return;
                if (!cfg.configured) {
                    self.setQuestionsRunning(false);
                    $st.text('Error: ' + cfg.error);
                    self.showAlert('danger', self.explainBackend({status: 503, responseJSON: {error: cfg.error}}, {again: again}));
                    return;
                }
                var mode = kind === 'brands' ? 'brands' : 'questions';
                var queue = _.map(_.chunk(todo, kind === 'brands' ? (cfg.batchBrands || 150) : cfg.batch), function(keys){ return {mode: mode, keys: keys}; });
                var st = {q: 0, b: 0, sent: 0, failed: 0, skipped: 0, failedKeys: [], retries: 0, requests: 0, pin: 0, pout: 0, preason: 0, today: cfg.today, limit: cfg.dailyLimit, fatal: null, problem: null, xhr: null};
                var model = $('#questions-model').val();
                var what = kind === 'brands' ? 'Brands' : 'Questions';
                self.startLivePoll();

                function finish(){
                    self.stopLivePoll();
                    self.setQuestionsRunning(false);
                    var done = kind === 'brands' ? st.b : st.q;
                    var result = kind === 'brands' ? st.b + ' of ' + total + ' classified' : st.q + ' of ' + total + ' generated';
                    $st.text((st.fatal ? 'Stopped - see the notice below. ' : (self.questionsStop ? 'Stopped by you. ' : '')) +
                        what + ' (' + model + (kind === 'brands' ? ', brand "' + (brand || '(none)') + '"' : '') + '): ' + result + ', ' + st.failed + (st.fatal ? ' not processed' : ' failed') +
                        ' (' + st.requests + ' requests; tokens in/out/reasoning: ' + st.pin + '/' + st.pout + '/' + st.preason +
                        '; requests today ' + st.today + '/' + st.limit + ').');
                    self.updateBrandInfo();
                    var ctx = {again: again, done: done, total: total, today: st.today, limit: st.limit};
                    if (st.xhr) {
                        var ob = self.explainBackend(st.xhr, ctx);
                        ob.progress = ctx.done + ' of ' + total + ' keywords were done before the stop (they are in the table).';
                        self.showAlert(ob.level, ob);
                    } else if (st.problem) {
                        var op = self.explainProblem(st.problem, ctx);
                        self.showAlert(op.level, op);
                    } else if (st.failed > 0) {
                        self.showAlert('warning', {title: st.failed + ' keyword' + (st.failed === 1 ? '' : 's') + ' got no usable answer',
                            cause: 'The model skipped or garbled these keywords in 4 attempts in a row. Everything else was processed.',
                            duration: 'Not time-related.',
                            action: 'Press "' + again + '" again: only these rows are retried. If the same ones fail again, skip them, or lower GROQ_BATCH / GROQ_BATCH_BRANDS in .env.',
                            progress: done + ' of ' + total + ' keywords were done.',
                            details: 'Not answered: ' + st.failedKeys.join(' | ') + (st.failed > st.failedKeys.length ? ' | ...' : '') + '\nSee logs/questions-errors.log'});
                    } else if (st.skipped > 0 && !self.questionsStop) {
                        self.showAlert('warning', {title: st.skipped + ' keyword' + (st.skipped === 1 ? ' was' : 's were') + ' skipped',
                            cause: 'The model is not asked about keywords longer than 300 characters. They stay without a result.',
                            duration: 'Not time-related.',
                            action: 'Nothing to fix for the rest: ' + done + ' of ' + (total - st.skipped) + ' other keywords are done. Remove or shorten the skipped keywords if you need a result for them.'});
                    } else if (st.retries > 0 && !self.questionsStop) {
                        self.showAlert('info', {title: 'Finished, after ' + st.retries + ' automatic retr' + (st.retries === 1 ? 'y' : 'ies'),
                            cause: 'Groq answered with temporary errors (rate limit or server errors) in between; the server retried by itself.',
                            duration: 'The problem has cleared.', action: 'Nothing to do. All ' + done + ' results are in the table.'});
                    }
                }
                function next(){
                    if (gen !== self.generation) return;
                    if (!queue.length || self.questionsStop) return finish();
                    var job = queue.shift();
                    $st.text((kind === 'brands' ? 'Classifying brands... ' : 'Generating questions... ') + st.sent + '/' + total +
                        ' (sending ' + job.keys.length + ' keywords, this can take a few minutes)');
                    var payload = {keywords: job.keys, model: model, mode: job.mode, lang: $('#lang').val() || ''};
                    if (job.mode !== 'questions') payload.brand = brand;
                    $.ajax({
                        url: 'api/questions',
                        method: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify(payload)
                    }).done(function(res){
                        if (gen !== self.generation) return;
                        if (res.questions) { self.applyQuestions(res.questions); st.q += _.size(res.questions); }
                        if (res.brands) { self.applyBrands(res.brands, brand); st.b += _.size(res.brands); }
                        st.sent += job.keys.length;
                        st.failed += res.failed.length;
                        st.skipped += (res.skipped && ((res.skipped.tooLong || 0) + (res.skipped.invalid || 0))) || 0;
                        st.failedKeys = st.failedKeys.concat(res.failed).slice(0, 10);
                        st.retries += _.filter(res.errors, {kind: 'retry'}).length;
                        st.requests += res.usage.requests;
                        st.pin += res.usage.promptTokens; st.pout += res.usage.completionTokens; st.preason += res.usage.reasoningTokens;
                        st.today = res.today; st.limit = res.dailyLimit;
                        self.logQuestionErrors(res.errors);
                        if (res.fatal) { st.fatal = res.fatal; st.problem = res.problem || {type: 'other', status: null, message: res.fatal}; return finish(); }
                        next();
                    }).fail(function(xhr){
                        if (gen !== self.generation) return;
                        st.xhr = xhr;
                        st.fatal = (xhr.responseJSON && xhr.responseJSON.error) ||
                            (xhr.status === 404 || xhr.status === 405 ? 'backend not running (start with: npm start)' : 'request failed');
                        self.logQuestionErrors([{time: new Date().toISOString(), kind: 'http', status: xhr.status, message: st.fatal}]);
                        finish();
                    });
                }
                next();
            }).fail(function(xhr){
                if (gen !== self.generation) return;
                self.setQuestionsRunning(false);
                $st.text('Error: backend not running (start with: npm start)');
                self.showAlert('danger', self.explainBackend({status: xhr && xhr.status || 0}, {again: again}));
            });
        },

        brandFilter: 'all',

        brandKey: function(b){ return String(b || '').trim().replace(/\s+/g, ' ').toLowerCase(); },
        currentBrand: function(){ return String($('#brand-name').val() || '').trim().replace(/\s+/g, ' '); },
        needsQuestion: function(d){ return (d.question === null || d.question === undefined) && d.words >= 2; },
        needsBrand: function(d){
            return d.brand === null || d.brand === undefined || (d.brand !== 0 && d.brandFor !== this.brandKey(this.currentBrand()));
        },
        passesBrand: function(d){
            if (this.brandFilter === 'all' || !d) return true;
            if (this.brandFilter === 'nonbrand') return d.brand === 0;
            return d.brand === 2 && d.brandFor === this.brandKey(this.currentBrand());
        },

        applyBrands: function(map, brand){
            var self = this, any = false, bk = this.brandKey(brand);
            this.table.rows().every(function(){
                var d = this.data();
                var key = self.qKey(d.keyword);
                if (_.has(map, key)) { d.brand = map[key]; d.brandFor = bk; this.data(d); any = true; }
            });
            if (any) this.table.draw(false);
        },

        setBrandFilter: function(value){
            this.brandFilter = _.includes(['all', 'nonbrand', 'brand'], value) ? value : 'all';
            $('#brand-filter').val(this.brandFilter);
            localStorage.brandFilter = this.brandFilter;
            if (this.table) this.table.draw();
        },

        updateBrandInfo: function(){
            if (!this.table) return;
            var self = this, cur = this.currentBrand();
            $('#brand-filter option[value="brand"]').text('Only brand: ' + (cur || 'X'));
            var tot = 0, wait = 0, stale = 0, shown = 0;
            _.each(this.table.rows().data().toArray(), function(d){
                if (!self.passesFilter(d.keyword)) return;
                tot++;
                if (d.brand === null || d.brand === undefined) wait++;
                else if (self.needsBrand(d)) stale++;
            });
            var $i = $('#brand-info');
            if (!tot) { $i.text(''); return; }
            var parts = [];
            if (wait) parts.push(wait + ' not classified');
            if (stale) parts.push(stale + ' classified for another brand');
            if (this.brandFilter !== 'all' && (wait || stale)) parts.push('hidden by the filter until classified');
            if (this.brandFilter === 'brand' && !cur) parts.push('enter a brand name');
            $i.text(parts.length ? 'Brand filter: ' + parts.join('; ') + '.' : '');
        },

        fetchVolume: function(){
            var self = this;
            var $btn = $('#getvolume'), $status = $('#volume-status');
            if ($btn.prop('disabled')) return;
            this.clearAlert();
            var rows = this.table.rows({search: 'applied'}).data().toArray();
            var todo = _.uniq(_.map(_.filter(rows, function(r){return r.volume === null;}),
                function(r){return self.qKey(r.keyword);}));
            if (!todo.length) {
                $status.text('Nothing to look up (all filtered rows already have volume).');
                return;
            }
            var batches = _.chunk(todo, 1000), done = 0, skipped = 0;
            $btn.prop('disabled', true);

            function next(){
                if (!batches.length) {
                    $btn.prop('disabled', false);
                    $status.text('Volume loaded for ' + done + ' keywords' + (skipped ? ' (' + skipped + ' skipped: invalid for Keyword Planner)' : '') + '.');
                    self.table.draw(false);
                    return;
                }
                $status.text('Fetching volume... ' + done + '/' + todo.length);
                $.ajax({
                    url: 'api/volume',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        keywords: batches.shift(),
                        country: $('#country').val(),
                        lang: $('#lang').val()
                    })
                }).done(function(res){
                    skipped += res.skipped;
                    self.applyVolume(res.results);
                    done += _.size(res.results);
                    next();
                }).fail(function(xhr){
                    var msg = (xhr.responseJSON && xhr.responseJSON.error) ||
                        (xhr.status === 404 || xhr.status === 405 ? 'backend not running (start with: npm start)' : 'request failed');
                    $btn.prop('disabled', false);
                    $status.text('Error: ' + msg);
                    var oa = self.explainAds(xhr, 'Get search volume');
                    oa.progress = done + ' of ' + todo.length + ' keywords got their volume before the stop (they are in the table).';
                    self.showAlert(oa.level, oa);
                    self.table.draw(false);
                });
            }
            next();
        },

        conceptsRunning: false,
        conceptsStop: false,

        setConcepts: function(d, concepts){
            d.concepts = concepts;
            d.conceptNames = _.map(concepts, 'name').join(' | ');
            d.conceptGroups = _.map(concepts, function(c){ return c.group || '-'; }).join(' | ');
            d.conceptTypes = _.map(concepts, function(c){ return c.type || '-'; }).join(' | ');
        },
        showConceptColumns: function(){
            var t = this.table;
            ['conceptNames', 'conceptGroups'].forEach(function(n){ t.column(n + ':name').visible(true); });
        },
        applyConcepts: function(map){
            var self = this, any = false;
            this.table.rows().every(function(){
                var d = this.data();
                var key = self.qKey(d.keyword).toLowerCase();
                if (_.has(map, key)) { self.setConcepts(d, map[key]); this.data(d); any = true; }
            });
            if (any) { this.showConceptColumns(); this.table.draw(false); }
        },
        setConceptsRunning: function(running){
            this.conceptsRunning = running;
            $('#getconcepts').text(running ? 'Stop concepts' : 'Get concepts')
                .toggleClass('btn-danger', running).toggleClass('btn-default', !running);
        },

        fetchConcepts: function(){
            var self = this, $st = $('#concepts-status');
            if (this.conceptsRunning) { this.conceptsStop = true; $st.text('Stopping after the current request...'); return; }
            var todoMap = {}, zeroMap = {}, volOf = {};
            _.each(this.table.rows({search: 'applied'}).data().toArray(), function(r){
                if (r.concepts !== null && r.concepts !== undefined) return;
                var k = self.qKey(r.keyword).toLowerCase();
                if (r.volume === 0) zeroMap[k] = true;
                else { todoMap[k] = true; volOf[k] = Math.max(volOf[k] || 0, r.volume || 0); }
            });
            var remaining = _.sortBy(_.keys(todoMap), function(k){ return -volOf[k]; }), total = remaining.length, zeroVol = _.size(zeroMap);
            this.clearAlert();
            if (!total) {
                $st.text(zeroVol ? 'Nothing to look up: the ' + zeroVol + ' keywords without concepts have search volume 0 (Keyword Planner has no data for them).' : 'Nothing to look up (all filtered rows already have concepts).');
                return;
            }
            var maxReq = Math.max(1, Math.min(200, parseInt($('#concepts-max-requests').val(), 10) || 20));
            var gen = this.generation, st = {requests: 0, covered: 0, withConcepts: 0, empty: 0, noSeed: 0, seedRows: 0, idle: 0, idleStop: false, xhr: null};
            var tried = [], cont = null;
            this.conceptsStop = false;
            this.setConceptsRunning(true);

            function finish(){
                self.setConceptsRunning(false);
                var left = remaining.length - st.noSeed;
                $st.text('Concepts: ' + st.covered + ' of ' + total + ' keywords covered in ' + st.requests + ' request' + (st.requests === 1 ? '' : 's') +
                    ' (' + st.withConcepts + ' with concepts, ' + st.empty + ' without)' + (self.conceptsStop ? ', stopped by you' : '') + (zeroVol ? '; ' + zeroVol + ' keywords with volume 0 skipped' : '') + '.');
                if (st.xhr) {
                    var o = self.explainAds(st.xhr, 'Get concepts');
                    o.progress = st.covered + ' of ' + total + ' keywords were covered before the stop (they are in the table).';
                    self.showAlert(o.level, o);
                } else if (st.noSeed) {
                    self.showAlert('warning', {title: st.noSeed + ' keyword' + (st.noSeed === 1 ? '' : 's') + ' cannot be looked up',
                        cause: 'Keyword Planner rejects keywords longer than 80 characters or 10 words, and keywords with symbols such as ? ! , : = +. Concepts can only be asked for through a valid seed keyword, and none of the remaining ones is valid.',
                        duration: 'Not time-related.', action: 'Nothing to do; these rows stay without concepts. ' + st.covered + ' of ' + total + ' keywords were covered.'});
                } else if (left > 0 && st.idleStop && !self.conceptsStop) {
                    self.showAlert('info', {title: left + ' keyword' + (left === 1 ? '' : 's') + ' stay without concepts: further requests would not help',
                        cause: 'The last ' + st.idle + ' requests returned none of the remaining keywords in their idea lists. Google only annotates keywords that are in the Keyword Planner idea list of a seed; long-tail and rarely searched keywords are usually not in it.' + (zeroVol ? ' ' + zeroVol + ' more keywords have search volume 0 and were skipped, because Keyword Planner has no data for them at all.' : ''),
                        duration: 'Not time-related.', action: 'Nothing to do. For better coverage use a more general keyword that these rows share as a seed with the service "google ads ideas" (a single seed returns concepts together with the ideas).'});
                } else if (left > 0 && !self.conceptsStop) {
                    self.showAlert('info', {title: left + ' keyword' + (left === 1 ? '' : 's') + ' still without concepts (request limit of this click reached)',
                        cause: 'Google returns concepts only for requests with one seed keyword, so each of the ' + st.requests + ' requests covered only the keywords Google returned for its seed.',
                        duration: 'About ' + Math.max(1, Math.round(left / Math.max(1, st.covered / st.requests))) + ' more requests at this pace, roughly 1-3 seconds each.',
                        action: 'Press "Get concepts" again to continue with the next ' + maxReq + ' requests, or raise the limit under Advanced.'});
                } else if (st.seedRows > 0 && !self.conceptsStop) {
                    self.showAlert('info', {title: 'Done. ' + st.seedRows + ' keyword' + (st.seedRows === 1 ? '' : 's') + ' stay without concepts',
                        cause: 'Google does not annotate the seed keyword of a request, and ' + (st.seedRows === 1 ? 'this keyword was' : 'these keywords were') + ' used as seed' + (st.seedRows === 1 ? '' : 's') + ' because no other keyword of the table led to ' + (st.seedRows === 1 ? 'it' : 'them') + '.',
                        duration: 'Not time-related.', action: 'Nothing to do. If you need their concepts, add a more general keyword to the table (for example the first word) and press "Get concepts" again.'});
                } else if (st.covered > 0 && st.withConcepts === 0) {
                    self.showAlert('info', {title: 'Google returned no concepts',
                        cause: 'For these keywords (and this country and language) Keyword Planner has no concept annotations. Concepts exist mostly for product and brand keywords.',
                        duration: 'Not time-related.', action: 'Nothing to do. Try a more specific seed, or another country or language in Advanced.'});
                }
                self.table.draw(false);
            }
            function next(){
                if (gen !== self.generation) return;
                if (st.idle >= 4) { st.idleStop = true; return finish(); }
                if (!remaining.length || self.conceptsStop || st.requests >= maxReq) return finish();
                $st.text('Fetching concepts... ' + st.covered + '/' + total + ' keywords covered, request ' + (st.requests + 1) + ' of max ' + maxReq);
                $.ajax({
                    url: 'api/concepts',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({keywords: remaining, country: $('#country').val(), lang: $('#lang').val(), skipSeeds: tried, keepOrder: true,
                        seed: cont ? cont.seed : undefined, pageToken: cont ? cont.token : undefined})
                }).done(function(res){
                    if (gen !== self.generation) return;
                    if (res.noSeed) { st.noSeed = remaining.length; return finish(); }
                    if (res.seed) {
                        st.requests++;
                        if (res.seedRow) st.seedRows++;
                        if (res.fromCall === 0) st.idle++; else st.idle = 0;
                        if (res.nextPageToken && res.fromCall > 0) cont = {seed: res.seed, token: res.nextPageToken};
                        else { cont = null; tried.push(res.seed); }
                    }
                    self.applyConcepts(res.concepts);
                    var done = {};
                    _.each(res.concepts, function(list, k){ done[k] = true; st.covered++; if (list.length) st.withConcepts++; else st.empty++; });
                    var before = remaining.length;
                    remaining = _.filter(remaining, function(k){ return !done[k]; });
                    if (!res.seed && remaining.length === before) { st.noSeed = remaining.length; return finish(); }
                    window.setTimeout(next, 250);
                }).fail(function(xhr){
                    if (gen !== self.generation) return;
                    st.xhr = xhr; finish();
                });
            }
            next();
        },

        applyVolume: function(results){
            var self = this;
            var table = this.table, conceptsAny = false;
            table.rows().every(function(){
                var d = this.data();
                var m = results[self.qKey(d.keyword)];
                if (m) {
                    d.volume = m.volume;
                    d.cpc = m.cpc;
                    d.competition = m.competition;
                    d.competitionLevel = m.competitionLevel;
                    d.cpcLow = m.cpcLow;
                    d.cpcAvg = m.cpcAvg;
                    d.change3m = m.change3m;
                    d.changeYoy = m.changeYoy;
                    d.change3y = m.change3y;
                    d.trend = m.trend;
                    if (m.concepts !== undefined) { self.setConcepts(d, m.concepts); conceptsAny = true; }
                    this.data(d);
                }
            });
            if (conceptsAny) self.showConceptColumns();
            table.column('volume:name').visible(true);
            table.column('cpc:name').visible(true);
            table.column('competition:name').visible(true);
        },

        FilterAndDisplay: function() {
            var i = 0;
            var sb = '';

            var outputKeywords = this.keywordsToQuery;
            for (i = 0; i < Math.min(outputKeywords.length,this.options.maxQueueDisplay); i++) {
                sb += outputKeywords[i];
                sb += '\n';
            }
            if (outputKeywords.length>this.options.maxQueueDisplay) sb+='...\n';
            $("#input").val(sb);
            var roundInfo = (this.doWork && this.options && this.options.keepRunning && !this.ideasMode)
                ? ' &middot; round ' + this.suggestRound + ', query ' + this.keywordsToQueryIndex + ' of ' + this.numOfInitialKeywords + ' in this round'
                : '';
            $("#numofkeywords").html('Queue:' + outputKeywords.length + roundInfo);
        },


        getOptions: function(argOptions){
            var defaultOptions={
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
            };
            if (argOptions===undefined) argOptions={};
            return _.defaults(argOptions,this.getDomOptions(),defaultOptions);
        },

        getDomOptions: function(){

            var service= $('#service').val(),
                filterNegative = $('#filter-negative').val(),
                filterPositive = $('#filter-positive').val(),
                rateLimit = parseInt($('#rate-limit').val()),
                prefixes = $('#prefixes').val(),
                suffixes = $('#suffixes').val(),
                country = $('#country').val(),
                lang = $('#lang').val(),
                keepRunning = $('#keep-running').prop('checked');
            if (prefixes && prefixes.length)
                prefixes=_.uniq(_.filter(_.map(prefixes.split(','), function(p){return p.trim();})));
            else
                prefixes=undefined;
            if (suffixes && suffixes.length)
                suffixes=_.uniq(_.filter(_.map(suffixes.split(','), function(p){return p.trim();})));
            else
                suffixes=undefined;

            var options={};
            if (service) options.service=service;
            if (filterNegative) options.filterNegative=filterNegative;
            if (filterPositive) options.filterPositive=filterPositive;
            if (rateLimit) options.rateLimit=rateLimit;
            if (prefixes && prefixes.length) options.prefixes=prefixes;
            if (suffixes && suffixes.length) options.suffixes=suffixes;
            if (country) options.country=country;
            if (lang) options.lang=lang;
            if (keepRunning) options.keepRunning=keepRunning;
            return options;
        },

        loadSettings: function(){
            if (localStorage.defaultsVersion !== 'de5') {
                delete localStorage.prefixes;
                delete localStorage.suffixes;
                delete localStorage.country;
                delete localStorage.lang;
                localStorage.defaultsVersion = 'de5';
            }
            if (localStorage.service && this.services[localStorage.service]) $("#service").val( localStorage.service );
            if (localStorage.country) $('#country').val(localStorage.country);
            if (localStorage.lang) $('#lang').val(localStorage.lang);
            if (localStorage.filterNegative) $("#filter-negative").val( localStorage.filterNegative );
            if (localStorage.filterPositive) $("#filter-positive").val( localStorage.filterPositive );
            if (localStorage.rateLimit) $("#rate-limit").val( localStorage.rateLimit );
            if (localStorage.input) $("#input").val( localStorage.input );
            if (localStorage.prefixes) $("#prefixes").val( localStorage.prefixes );
            if (localStorage.suffixes) $("#suffixes").val( localStorage.suffixes );
            if (localStorage.ideasMaxRounds) $('#ideas-max-rounds').val(localStorage.ideasMaxRounds);
            if (localStorage.ideasMaxKeywords) $('#ideas-max-keywords').val(localStorage.ideasMaxKeywords);
            if (localStorage.ideasMinVolume) $('#ideas-min-volume').val(localStorage.ideasMinVolume);
            if (localStorage.keepRunning) $('#keep-running').prop('checked',localStorage.keepRunning=="true");
            if (localStorage.brandName) $('#brand-name').val(localStorage.brandName);
            if (localStorage.conceptsMaxRequests) $('#concepts-max-requests').val(localStorage.conceptsMaxRequests);
            if (localStorage.brandFilter) this.brandFilter = localStorage.brandFilter;

        },
        saveSettings: function(){
            localStorage.service = $('#service').val();
            localStorage.country = $('#country').val();
            localStorage.lang = $('#lang').val();
            localStorage.filterNegative = $('#filter-negative').val();
            localStorage.filterPositive = $('#filter-positive').val();
            localStorage.rateLimit = $('#rate-limit').val();
            localStorage.input = $('#input').val();
            localStorage.prefixes = $('#prefixes').val();
            localStorage.suffixes = $('#suffixes').val();
            localStorage.keepRunning = $('#keep-running').prop('checked');
            localStorage.ideasMaxRounds = $('#ideas-max-rounds').val();
            localStorage.ideasMaxKeywords = $('#ideas-max-keywords').val();
            localStorage.ideasMinVolume = $('#ideas-min-volume').val();
            localStorage.brandName = $('#brand-name').val();
            localStorage.brandFilter = this.brandFilter;
            localStorage.conceptsMaxRequests = $('#concepts-max-requests').val();
        },

        reset: function(){
            if (this.doWork) this.StopWork();
            this.generation++;
            this.queryLock = false;
            this.setQuestionsRunning(false);
            $('#questions-status').text(''); $('#brands-status').text('');
            this.stopLivePoll(); this.clearAlert();
            this.lastSeed = null;
            this.setConceptsRunning(false); $('#concepts-status').text('');
            $('#questions-log').text(''); this.questionErrorCount = 0; $('#questions-errors-count').text('0'); $('#questions-log-box').hide();
            this.keywordsToQuery = [];
            this.keywordsToQueryIndex = 0;
            this.hashMapInputs = {};
            this.ideaRows = {};
            this.table.clear();
            this.table.draw();
            $('#input').val('');
            $('#numofkeywords').html('');
            $('#volume-status').text('');
            this.updateBrandInfo();
            this.saveSettings();
        },

        init: function(){

            var isGoogle = function(s){ return s.indexOf('google') === 0 || s === 'youtube'; };
            var label = function(s){ return s === 'google' ? 'google autosuggest' : s; };
            var keys = _.sortBy(_.keys(this.services), [
                function(s){ return isGoogle(s) ? 0 : 1; },
                label
            ]);
            keys.forEach(function(service){
                $('#service').append($('<option>').val(service).text(label(service)));
            });
            $('#service').val('google');


            this.loadSettings();
            this.options = this.getOptions();

            var self = this;
            (function tick(){
                self.DoJob();
                window.setTimeout(tick, Math.max(50, parseInt($('#rate-limit').val()) || 750));
            })();

            $('#progress1').addClass('progressjs-progress');
            this.progress1 = progressJs("#progress1");

            $('#startjob').on('click',this.toggleWork.bind(this));
            $('#reset').on('click',this.reset.bind(this));

        var signedPct = function(d, type){
            if (d === null || d === undefined) return type === 'display' ? '' : -Infinity;
            return (type === 'display' && d > 0) ? '+' + d : d;
        };
            var csvAction = function(e, dt, node, config){
                config.filename = KWS.exportFilename();
                $.fn.dataTable.ext.buttons.csvHtml5.action.call(this, e, dt, node, config);
            };
            var exportAction = function(kind, withSeries){
                return function(e, dt, node, config){
                    config.exportOptions = $.extend({}, config.exportOptions, {columns: KWS.exportColumns(withSeries)});
                    if (kind === 'csv') config.filename = KWS.exportFilename();
                    $.fn.dataTable.ext.buttons[kind === 'csv' ? 'csvHtml5' : 'copyHtml5'].action.call(this, e, dt, node, config);
                };
            };
            var escRender = function(d, type){ return (type === 'display' && typeof d === 'string') ? _.escape(d) : d; };

            this.table = $('#outtable').DataTable({
                pageLength: 25,
                "lengthMenu": [ 10, 25, 50, 75, 100,800],
                dom:
                "<'mai-tablebar'<'mai-tablebar__left'B><'mai-tablebar__right'f>>" +
                "<'mai-tablewrap'tr>" +
                "<'mai-tablefoot'<'mai-tablefoot__info'i><'mai-tablefoot__pager'p>>",
                buttons: [
                    { extend: 'colvis', columns: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18] },
                    'pageLength',
                    {
                         extend: 'collection',
                         text: 'Export',
                         buttons: [
                             { extend: 'copyHtml5', action: exportAction('copy', true), exportOptions: { columns: [':visible', 'conceptTypes:name', 'trend:name'], decodeEntities: true } },
                             { extend: 'csvHtml5', action: exportAction('csv', true), exportOptions: { columns: [':visible', 'conceptTypes:name', 'trend:name'], decodeEntities: true } },
                             {
                                 extend: 'csvHtml5', action: csvAction,
                                 fieldBoundary: "",
                                 text: 'Copy keywords',
                                 header: false,
                                 exportOptions: {
                                     stripNewlines: true,
                                     stripHtml: true,
                                     decodeEntities: true,
                                     columns: 1,
                                 }
                             },
                             {
                                 extend: 'csvHtml5', action: exportAction('csv', false),
                                 fieldBoundary: "",
                                 text: 'Copy visible columns',
                                 header: false,
                                 exportOptions: {
                                     columns: ':visible',
                                     stripNewlines: true,
                                     stripHtml: true,
                                     decodeEntities: true,
                                 }
                             },
                         ]
                     },

                ],
                "columnDefs": [
                {
                    "title": "id",
                    "data": "id",
                    "targets": 0,
                    "visible": false,
                }, {
                    "name": "keyword",
                    "title": "Keyword",
                    "data": "keyword",
                    "render": escRender,
                    "responsivePriority": 1,
                    "targets": 1,
                }, {
                    "title": "Length",
                    "data": "length",
                    "targets": 2,
                    "visible": false,
                    "type": "num"
                }, {
                    "name": "volume",
                    "title": "Volume",
                    "data": "volume",
                    "targets": 3,
                    "visible": false,
                    "type": "num"
                }, {
                    "name": "cpc",
                    "title": "CPC (high bid)",
                    "data": "cpc",
                    "targets": 4,
                    "visible": false,
                    "type": "num"
                }, {
                    "name": "competition",
                    "title": "Competition",
                    "data": "competition",
                    "targets": 8,
                    "visible": false,
                    "type": "num"
                }, {
                    "title": "Search",
                    "data": "search",
                    "render": escRender,
                    "responsivePriority": 3,
                    "targets": 5,
                    "visible": false,
                }, {
                    "title": "Domain",
                    "data": "domain",
                    "render": escRender,
                    "responsivePriority": 2,
                    "targets": 6,
                    "visible": false,
                }, {
                    "title": "Words",
                    "data": "words",
                    "targets": 7,
                    "visible": false,
                    "type": "num"
                }, {
                    "name": "competitionLevel",
                    "title": "Competition level",
                    "data": "competitionLevel",
                    "render": escRender,
                    "targets": 9,
                    "visible": false
                }, {
                    "name": "cpcLow",
                    "title": "CPC (low bid)",
                    "data": "cpcLow",
                    "targets": 10,
                    "visible": false,
                    "type": "num"
                }, {
                    "name": "cpcAvg",
                    "title": "CPC (avg)",
                    "data": "cpcAvg",
                    "targets": 11,
                    "visible": false,
                    "type": "num"
                }, {
                    "name": "change3m",
                    "title": "3-month change %",
                    "data": "change3m",
                    "render": signedPct,
                    "targets": 12,
                    "visible": false,
                    "type": "num"
                }, {
                    "name": "changeYoy",
                    "title": "12-month change % (YoY)",
                    "data": "changeYoy",
                    "render": signedPct,
                    "targets": 13,
                    "visible": false,
                    "type": "num"
                }, {
                    "name": "change3y",
                    "title": "3-year change %",
                    "data": "change3y",
                    "render": signedPct,
                    "targets": 14,
                    "visible": false,
                    "type": "num"
                }, {
                    "name": "question",
                    "className": "mai-col-q",
                    "title": "Question",
                    "data": "question",
                    "render": escRender,
                    "targets": 15,
                    "visible": false
                }, {
                    "name": "trend",
                    "title": "Monthly volume (48 mo, oldest first)",
                    "data": "trend",
                    "render": escRender,
                    "targets": 16,
                    "visible": false,
                    "className": "export-only"
                }, {
                    "name": "conceptNames",
                    "className": "mai-col-c",
                    "title": "Concepts (Google)",
                    "data": "conceptNames",
                    "render": escRender,
                    "targets": 17,
                    "visible": false
                }, {
                    "name": "conceptGroups",
                    "className": "mai-col-c",
                    "title": "Concept groups (Google)",
                    "data": "conceptGroups",
                    "render": escRender,
                    "targets": 18,
                    "visible": false
                }, {
                    "name": "conceptTypes",
                    "className": "export-only",
                    "title": "brand filter",
                    "data": "conceptTypes",
                    "render": escRender,
                    "targets": 19,
                    "visible": false
                },
            ],
                order: [[ 0, 'desc' ]],
                stateSave: true,
                "bDeferRender": true,
            });
            this.table.column('conceptTypes:name').visible(false, false);

            $.fn.dataTable.ext.search.push(function(settings, data, dataIndex, rowData){
                if (settings.nTable.id !== 'outtable') return true;
                return KWS.passesFilter(data[1]) && KWS.passesBrand(settings.aoData[dataIndex] && settings.aoData[dataIndex]._aData);
            });
            $('#filter-positive, #filter-negative').on('input', _.debounce(this.updateFilters.bind(this), 250));
            $('#getvolume').on('click', this.fetchVolume.bind(this));
            $('#getconcepts').on('click', this.fetchConcepts.bind(this));
            $('#getquestions').on('click', this.generateQuestions.bind(this));
            $('#getbrands').on('click', this.classifyBrands.bind(this));
            $('#nav-export').on('click', function(){
                window.setTimeout(function(){
                    $('.dt-buttons .buttons-collection').filter(function(){ return $(this).text().trim() === 'Export'; }).first().trigger('click');
                }, 350);
            });
            $('#brand-filter').on('change', function(){ self.setBrandFilter($(this).val()); self.updateBrandInfo(); });
            $('#brand-name').on('input', _.debounce(function(){
                localStorage.brandName = $('#brand-name').val();
                self.updateBrandInfo();
                if (self.brandFilter === 'brand') self.table.draw();
            }, 250));
            $('#outtable').on('draw.dt', _.debounce(function(){ self.updateBrandInfo(); }, 100));
            $.getJSON('api/questions/status').done(function(cfg){
                var $m = $('#questions-model').empty();
                (cfg.models || []).forEach(function(m){ $m.append($('<option>').val(m).text(m)); });
                if (cfg.model) $m.val(cfg.model);
                $m.toggle((cfg.models || []).length > 1);
            });
            $('#questions-log-copy').on('click', function(){
                var text = $('#questions-log').text();
                if (navigator.clipboard) navigator.clipboard.writeText(text);
            });
            var toggleIdeas = function(){ $('#ideas-options').toggle($('#service').val() === IDEAS_SERVICE); };
            $('#service').on('change', toggleIdeas);
            toggleIdeas();
            this.updateFilters();
            this.setBrandFilter(this.brandFilter);
            this.updateBrandInfo();

            $.getJSON('https://api.ipify.org?format=json', function (data) {
                this.myIp = data.ip;
            });

        }
    };
}();
