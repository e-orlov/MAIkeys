(function () {
    var HELP = {
        'input': {
            title: 'Seeds',
            html: '<p>One seed keyword per line. Blank lines and repeated seeds are ignored.</p>' +
                '<p>"Do Keywords!" sends every seed to the chosen Service. For the suggest services each seed is also combined with every prefix and suffix from Advanced (prefix + seed, seed + suffix).</p>' +
                '<p>With an empty box, the letters and question words from Prefixes and Suffixes are still expanded.</p>' +
                '<p>While a job runs, the box shows the queue: a check mark means the query returned suggestions, a cross means it returned none.</p>' +
                '<p>Service "google ads ideas": up to 20 seeds per request, prefixes and suffixes are not used.</p>'
        },
        'questions-model': {
            title: 'Groq model',
            html: '<p>The Groq model used by "Generate questions" and "Classify brands".</p>' +
                '<p>The list comes from <code>GROQ_MODELS</code> in the <code>.env</code> file. The list is shown only when more than one model is configured.</p>'
        },
        'brand-filter': {
            title: 'Brand filter',
            html: '<p>Shows only some of the rows, in the table and in every export. Three states:</p>' +
                '<ul><li><b>All keywords</b>: everything (default).</li>' +
                '<li><b>Non-brand only</b>: keywords with brand class 0 (no brand mentioned).</li>' +
                '<li><b>Only brand: X</b>: keywords with class 2 (the brand typed in the Brand field is mentioned).</li></ul>' +
                '<p>The classes come from "Classify brands". Keywords without a class are hidden in the two brand states, and a line under the filter says how many are waiting.</p>' +
                '<p>The filter works together with Include, Exclude and the table search. The classes are not shown as a column and are not exported.</p>'
        },
        'brand-name': {
            title: 'Brand',
            html: '<p>The brand X for "Classify brands" and for the filter "Only brand: X". Up to 80 characters.</p>' +
                '<ul><li><b>Class 2</b>: X is mentioned, alone or with other brands.</li>' +
                '<li><b>Class 1</b>: other brands are mentioned, but not X.</li>' +
                '<li><b>Class 0</b>: no brand is mentioned.</li></ul>' +
                '<p>If you change the brand, run "Classify brands" again: keywords that were class 1 or 2 are asked again, class 0 stays valid. An empty field is allowed; then no keyword gets class 2.</p>'
        },
        'filter-positive': {
            title: 'Include',
            html: '<p>Keeps only keywords that contain at least one of these terms. One term per line. Not case-sensitive, the term may sit anywhere in the keyword.</p>' +
                '<p>Applies to the table and to every export. Empty means no filter.</p>' +
                '<p>Include does not shorten the query queue: a keyword that does not match can still lead to matching suggestions. To save requests use Exclude.</p>'
        },
        'filter-negative': {
            title: 'Exclude',
            html: '<p>Drops keywords that contain any of these terms. One term per line. Not case-sensitive, the term may sit anywhere in the keyword.</p>' +
                '<p>Applies to the table and to every export.</p>' +
                '<p>Excluded keywords are also never queried or expanded further, so Exclude shortens the query queue and saves requests.</p>'
        },
        'concepts-max-requests': {
            title: 'Concepts: max requests per click',
            html: '<p>Upper limit of Google requests for one click on "Get concepts". 1 to 200, default 20.</p>' +
                '<p>Google returns keyword concepts only for requests with one seed keyword. Each request takes the most general keyword that has no concepts yet and fills every shown row that Google returns for it, usually many rows.</p>' +
                '<p>Keywords with volume 0 are skipped. When the limit is reached, press the button again to continue.</p>'
        },
        'service': {
            title: 'Service',
            html: '<p>Where the keywords come from.</p>' +
                '<ul><li><b>google autosuggest</b> (default), <b>google images</b>, <b>google news</b>, <b>google shopping</b>, <b>youtube</b>, <b>bing</b>, <b>yahoo</b>: suggest services, asked by your browser one query at a time. Each seed is expanded with the prefixes and suffixes.</li>' +
                '<li><b>google ads ideas</b>: related keywords from the Google Ads Keyword Planner. Needs the Google Ads values in <code>.env</code>. Up to 20 seeds per request, prefixes and suffixes are not used, and the three "Ads ideas" fields appear.</li></ul>' +
                '<p>Only the Google services use Country and Language. Third-party suggest endpoints can change without notice.</p>'
        },
        'prefixes': {
            title: 'Prefixes',
            html: '<p>Words put before each seed, separated by commas. Spaces inside an entry are kept (for example <code>wie lange</code>). Entries are trimmed, empty ones and duplicates are dropped.</p>' +
                '<p>Every prefix means one more query per seed, so a long list means a long run (about 0.75 seconds per query).</p>' +
                '<p>Default: the 26 letters and German question words. Not used by "google ads ideas".</p>'
        },
        'suffixes': {
            title: 'Suffixes',
            html: '<p>Words put after each seed, separated by commas. Spaces inside an entry are kept (for example <code>in der nähe</code>). Entries are trimmed, empty ones and duplicates are dropped.</p>' +
                '<p>Every suffix means one more query per seed, so a long list means a long run (about 0.75 seconds per query).</p>' +
                '<p>Default: the 26 letters and some German words. Not used by "google ads ideas".</p>'
        },
        'keep-running': {
            title: 'Continuous running',
            html: '<p><b>Off</b> (default): one pass over the queue, then the run ends.</p>' +
                '<p><b>On</b>: for the suggest services, the keywords found are queried again as new seeds, round after round, until you press "Stop doing".</p>' +
                '<p>For "google ads ideas", the ideas found become the seeds of the next round. Max rounds, stop-at and min. volume below limit this.</p>' +
                '<p>The table and the queue can grow very fast with this option on. The total is unknown, so the line under the header slides instead of filling up, and the label above the seeds shows the round and the position in it.</p>'
        },
        'ideas-max-rounds': {
            title: 'Ads ideas: max rounds',
            html: '<p>Only for "google ads ideas" with Continuous running on. 1 to 10, default 2.</p>' +
                '<p>Round 1 uses your seed keywords, round 2 uses the ideas found in round 1, and so on.</p>'
        },
        'ideas-max-keywords': {
            title: 'Ads ideas: stop at (results)',
            html: '<p>Only for "google ads ideas". The job stops when the table holds this many results. Default 5000.</p>' +
                '<p>The count is made after Include and Exclude.</p>'
        },
        'ideas-min-volume': {
            title: 'Ads ideas: min. volume for the next round',
            html: '<p>Only for "google ads ideas". Ideas below this monthly search volume stay in the table but are not used as seeds for the next round.</p>' +
                '<p>0 (default) expands every idea.</p>'
        },
        'country': {
            title: 'Country',
            html: '<p>The market for Google suggestions, search volume, ideas and concepts. Default: Germany.</p>' +
                '<p>An empty value means no geographic filter for the Google Ads lookups. Suggest services other than Google ignore it.</p>'
        },
        'lang': {
            title: 'Language',
            html: '<p>The language for Google suggestions, search volume, ideas and concepts. Default: German.</p>' +
                '<p>It is also the language of the questions from "Generate questions": every question is written in this language, even if the keyword is in another one. If the field is empty, each question uses the language of its keyword.</p>' +
                '<p>Suggest services other than Google ignore it.</p>'
        }
    };

    var openBtn = null;

    function closeAll() {
        if (openBtn) {
            $(openBtn).popover('hide').attr('aria-expanded', 'false');
            openBtn = null;
        }
    }

    function keepVisible(btn) {
        setTimeout(function () {
            var pop = document.querySelector('.mai-popover');
            if (!pop || openBtn !== btn) return;
            var r = pop.getBoundingClientRect();
            var over = r.bottom - (window.innerHeight - 8);
            if (over > 0) {
                var room = btn.getBoundingClientRect().top - 84;
                window.scrollBy(0, Math.max(0, Math.min(over, room)));
            }
        }, 30);
    }

    function makeButton(id, title) {
        var $b = $('<button type="button" class="mai-info" aria-expanded="false"></button>')
            .attr('aria-label', 'Help: ' + title)
            .attr('data-help', id)
            .text('i');
        $b.popover({
            trigger: 'manual',
            html: true,
            container: 'body',
            placement: 'auto bottom',
            viewport: { selector: 'body', padding: 8 },
            title: title,
            content: HELP[id].html,
            template: '<div class="popover mai-popover" role="dialog"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'
        });
        $b.on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (openBtn === this) { closeAll(); return; }
            closeAll();
            openBtn = this;
            $(this).popover('show').attr('aria-expanded', 'true');
            keepVisible(this);
        });
        return $b;
    }

    function place(id) {
        var $el = $('#' + id);
        if (!$el.length) return;
        var title = HELP[id].title;
        var $btn = makeButton(id, title);
        var $label = $('label[for="' + id + '"]').first();
        if ($label.length) {
            $label.append($btn);
        } else if (id === 'brand-name') {
            $el.wrap('<span class="mai-fieldwrap"></span>').after($btn);
        } else {
            $el.after($btn);
        }
    }

    $(function () {
        Object.keys(HELP).forEach(place);
        $(document).on('click', function (e) {
            if (!openBtn) return;
            if ($(e.target).closest('.mai-popover').length) return;
            closeAll();
        });
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape' && openBtn) {
                var b = openBtn;
                closeAll();
                $(b).focus();
            }
        });
        $(window).on('resize', closeAll);
        $('#advanced').on('hide.bs.collapse', closeAll);
    });
})();
