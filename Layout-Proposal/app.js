(function () {
    'use strict';

    // Mapping: nav card span text → data-page value → header h2 text
    var PAGES = {
        'Dashboard':          { page: 'dashboard',  title: 'Dashboard' },
        'Egress Logs':        { page: 'egress',     title: 'Egress Logs' },
        'Security Analytics': { page: 'analytics',  title: 'Security Analytics' },
        'Risk Algorithm':     { page: 'risk',       title: 'Risk Algorithm' },
        'Policy Algorithm':   { page: 'policy',     title: 'Policy Algorithm' }
    };

    var navCards = document.querySelectorAll('.nav-card');
    var sections = document.querySelectorAll('.page-section');
    var headerTitle = document.getElementById('page-title');
    var hero = document.querySelector('.hero');

    function switchToPage(pageKey) {
        var config = PAGES[pageKey];
        if (!config) return;

        // 1. Update nav card active/transparent state
        navCards.forEach(function (card) {
            var span = card.querySelector('span');
            var isTarget = span && span.textContent.trim() === pageKey;
            card.classList.toggle('active', isTarget);
            card.classList.toggle('transparent', !isTarget);
        });

        // 2. Show/hide page sections
        sections.forEach(function (section) {
            section.classList.toggle('hidden', section.dataset.page !== config.page);
        });

        // 3. Update header h2 title
        if (headerTitle) {
            headerTitle.textContent = config.title;
        }

        // 4. Set body attribute for CSS scoping (background gradients, accent colors)
        document.body.setAttribute('data-current-page', config.page);

        // 5. Reset scroll position
        if (hero) {
            hero.scrollTop = 0;
        }
    }

    // Attach click handlers to each nav card
    navCards.forEach(function (card) {
        card.addEventListener('click', function (e) {
            e.preventDefault();
            var span = this.querySelector('span');
            if (span) {
                switchToPage(span.textContent.trim());
            }
        });
    });

    // Initialize: show Dashboard on page load
    switchToPage('Dashboard');
})();
