// ========================================
// Main JavaScript
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    initCountdown();
    initSmoothScroll();
    initScrollEffects();
    initMobileMenu();
    initServiceSelector();
    initNewsletter();
    initStatsAnimation();
    initStoreRunCalendar();
});

// ========================================
// Countdown Timer
// ========================================

function initCountdown() {
    // Order deadline: Thursday 11:59 PM JST (requirement)
    const now = new Date();
    const deadline = getNextThursday(now);
    deadline.setHours(23, 59, 59, 999);
    
    function getNextThursday(date) {
        const result = new Date(date);
        const day = result.getDay(); // 0=Sun, 4=Thu
        let daysUntilThursday = (4 - day + 7) % 7;
        if (daysUntilThursday === 0 && result.getHours() >= 23) daysUntilThursday = 7;
        result.setDate(result.getDate() + daysUntilThursday);
        return result;
    }
    
    function updateCountdown() {
        const now = new Date();
        const timeLeft = deadline - now;
        
        if (timeLeft <= 0) {
            // Deadline passed, show next run information
            showNextRun();
            return;
        }
        
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');
        
        if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
    }
    
    function showNextRun() {
        const nextRunEl = document.getElementById('next-run');
        if (nextRunEl) {
            nextRunEl.innerHTML = '<strong>⏰ Deadline passed!</strong> Next run: March 8 (Ikebukuro Animate)';
            nextRunEl.style.color = 'var(--color-primary)';
            nextRunEl.style.fontSize = '1.125rem';
        }
        
        // Update badge
        const badge = document.querySelector('.upcoming-header .badge');
        if (badge) {
            badge.textContent = 'Closed';
            badge.classList.remove('badge-urgent');
            badge.style.background = '#6b7280';
        }
    }
    
    // Update every second
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// ========================================
// Smooth Scroll for Anchor Links
// ========================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Don't prevent default for links that just go to #
            if (href === '#') return;
            
            e.preventDefault();
            
            const target = document.querySelector(href);
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                const nav = document.getElementById('nav');
                if (nav && nav.classList.contains('active')) {
                    nav.classList.remove('active');
                }
            }
        });
    });
}

// ========================================
// Scroll Effects (Header & Scroll to Top)
// ========================================

function initScrollEffects() {
    const header = document.getElementById('header');
    const scrollTop = document.getElementById('scrollTop');
    
    window.addEventListener('scroll', function() {
        // Header shadow on scroll
        if (window.scrollY > 50) {
            header?.classList.add('scrolled');
        } else {
            header?.classList.remove('scrolled');
        }
        
        // Show/hide scroll to top button
        if (window.scrollY > 300) {
            scrollTop?.classList.add('visible');
        } else {
            scrollTop?.classList.remove('visible');
        }
    });
    
    // Scroll to top functionality
    if (scrollTop) {
        scrollTop.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

// ========================================
// Mobile Menu
// ========================================

function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const nav = document.getElementById('nav');
    
    if (hamburger && nav) {
        hamburger.addEventListener('click', function() {
            nav.classList.toggle('active');
            this.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!hamburger.contains(e.target) && !nav.contains(e.target)) {
                nav.classList.remove('active');
                hamburger.classList.remove('active');
            }
        });
    }
}

// ========================================
// Request Form Functions
// ========================================

function openRequestForm(serviceType = 'standard', itemName = '', itemUrl = '') {
    // Navigate to request form page. Path works from index and from category/*.
    const cfg = window.CONFIG || {};
    const formPath = cfg.REQUEST_FORM_PATH || 'request.html';
    const isCategory = window.location.pathname.indexOf('/category/') !== -1;
    const requestPath = isCategory ? '../' + formPath : formPath;
    const params = new URLSearchParams();
    if (serviceType) params.set('service_type', serviceType);
    if (itemName) params.set('item_name', itemName);
    if (itemUrl) params.set('item_url', itemUrl);
    const query = params.toString();
    window.location.href = requestPath + (query ? '?' + query : '');
}

// Make it globally available
window.openRequestForm = openRequestForm;

// ========================================
// Service Selector Flow
// ========================================

function initServiceSelector() {
    // This is just for demonstration
    // In production, you might want more sophisticated logic
}

function showQ2() {
    const q2 = document.getElementById('q2');
    if (q2) {
        q2.style.display = 'block';
        q2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function selectService(serviceType) {
    openRequestForm(serviceType);
}

// Make functions globally available
window.showQ2 = showQ2;
window.selectService = selectService;

// ========================================
// Animation on Scroll (Optional Enhancement)
// ========================================

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements with fade-in class
    document.querySelectorAll('.fade-in').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Call this if you add fade-in classes to elements
// initScrollAnimations();

// ========================================
// Newsletter Form (Optional)
// ========================================

function initNewsletter() {
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = this.querySelector('input[type="email"]').value;
            alert('Thanks for subscribing! We\'ll send updates to ' + email);
            this.reset();
        });
    }
}

// ========================================
// Stats Counter Animation (Optional)
// ========================================

function animateStats() {
    const stats = document.querySelectorAll('.stat-value');
    stats.forEach(function(stat) {
        var text = stat.textContent;
        var target = parseInt(text.replace(/\D/g, ''), 10);
        var suffix = text.replace(/[0-9]/g, '');
        var current = 0;
        var increment = target / 50;
        var timer = setInterval(function() {
            current += increment;
            if (current >= target) {
                stat.textContent = target + suffix;
                clearInterval(timer);
            } else {
                stat.textContent = Math.floor(current) + suffix;
            }
        }, 30);
    });
}

function initStatsAnimation() {
    var statsSection = document.getElementById('stats');
    if (statsSection) {
        var statsObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    animateStats();
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        statsObserver.observe(statsSection);
    }
}

// ========================================
// Store Run Calendar (Fridays = store visit)
// ========================================

function initStoreRunCalendar() {
    var titles = [
        document.getElementById('calendar-title-1'),
        document.getElementById('calendar-title-2')
    ];
    var daysContainers = [
        document.getElementById('calendar-days-1'),
        document.getElementById('calendar-days-2')
    ];
    if (!daysContainers[0] || !daysContainers[1]) return;

    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();

    for (var i = 0; i < 2; i++) {
        var m = month + i;
        var y = year;
        if (m > 11) { m -= 12; y += 1; }
        var first = new Date(y, m, 1);
        var last = new Date(y, m + 1, 0);
        var startOffset = first.getDay();
        var daysInMonth = last.getDate();

        if (titles[i]) {
            titles[i].textContent = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }

        var html = '';
        for (var k = 0; k < startOffset; k++) {
            html += '<div class="calendar-day calendar-day--empty"></div>';
        }
        var today = new Date();
        var todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

        for (var d = 1; d <= daysInMonth; d++) {
            var cellDate = new Date(y, m, d);
            var isFriday = cellDate.getDay() === 5;
            var isToday = cellDate.getTime() === todayStart;
            var classes = 'calendar-day';
            if (isFriday) classes += ' calendar-day--friday';
            if (isToday) classes += ' calendar-day--today';
            var label = isFriday ? '<span class="calendar-day__label">Run</span>' : '';
            html += '<div class="' + classes + '">' + d + label + '</div>';
        }

        daysContainers[i].innerHTML = html;
    }
}
