// ===================================
// MAIN JAVASCRIPT - DR. CHI WEBSITE
// ===================================

// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });

        // Close menu when clicking on a link
        const navLinks = document.querySelectorAll('.nav-menu a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }

    // Initialize features based on page
    initializeDailyQuote();
    initializeWeeklyChallenge();
    initializeScrollAnimations();
});

// ===================================
// DAILY QUOTE ROTATION
// ===================================
function initializeDailyQuote() {
    const quoteElement = document.getElementById('daily-quote');
    const dateElement = document.getElementById('quote-date');
    
    if (!quoteElement || !dateElement) return;

    const quotes = [
        {
            text: "Better Than Yesterday means measuring your progress against yourself, not against others. The only competition that matters is with who you were yesterday.",
            author: "Dr. Chi"
        },
        {
            text: "Self-love isn't selfish. When you fill your own cup first, you have unlimited compassion to pour into others.",
            author: "Dr. Chi"
        },
        {
            text: "Before you judge someone, pause and ask: What might they be going through? This simple question transforms conflict into connection.",
            author: "Dr. Chi"
        },
        {
            text: "Your greatest strength as a dentist isn't your technical skill—it's your ability to make patients feel heard, understood, and cared for.",
            author: "Dr. Chi"
        },
        {
            text: "Perfectionism is the enemy of progress. Embrace being 1% better each day rather than waiting to be 100% ready.",
            author: "Dr. Chi"
        },
        {
            text: "The quality of your questions determines the quality of your life. Instead of 'Why is this happening to me?', ask 'What can I learn from this?'",
            author: "Dr. Chi"
        },
        {
            text: "Kindness is not weakness. It takes tremendous strength to respond with compassion when someone is difficult.",
            author: "Dr. Chi"
        },
        {
            text: "Your morning sets the tone for your day. Start with gratitude, and everything that follows becomes a gift.",
            author: "Dr. Chi"
        },
        {
            text: "Success is not about never failing. It's about learning from each setback and moving forward with wisdom.",
            author: "Dr. Chi"
        },
        {
            text: "When you change the way you look at things, the things you look at change. Perspective is everything.",
            author: "Dr. Chi"
        },
        {
            text: "The gap between who you are and who you want to be is bridged by consistent daily actions, not grand gestures.",
            author: "Dr. Chi"
        },
        {
            text: "Listening is not waiting for your turn to speak. It's being fully present to understand another's experience.",
            author: "Dr. Chi"
        },
        {
            text: "Your peace of mind is worth more than winning an argument. Sometimes the strongest thing you can do is let it go.",
            author: "Dr. Chi"
        },
        {
            text: "Excellence is not a destination—it's a daily practice. Show up, do your best, and trust the process.",
            author: "Dr. Chi"
        },
        {
            text: "The most powerful investment you can make is in yourself. Skills, knowledge, and mindset compound over time.",
            author: "Dr. Chi"
        }
    ];

    // Get quote based on day of year for consistency
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const selectedQuote = quotes[dayOfYear % quotes.length];

    // Display quote with animation
    quoteElement.style.opacity = '0';
    setTimeout(() => {
        quoteElement.innerHTML = `"${selectedQuote.text}"<br><br>— ${selectedQuote.author}`;
        quoteElement.style.transition = 'opacity 1s ease';
        quoteElement.style.opacity = '1';
    }, 100);

    // Display date
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = today.toLocaleDateString('en-US', options);
}

// ===================================
// WEEKLY CHALLENGE
// ===================================
function initializeWeeklyChallenge() {
    const challengeElement = document.getElementById('weekly-challenge');
    
    if (!challengeElement) return;

    const challenges = [
        {
            title: "Gratitude Practice",
            description: "Each morning this week, write down three things you're grateful for about yourself. Not accomplishments—qualities, efforts, or simply your existence.",
            tasks: [
                "Day 1: Identify three personal qualities you appreciate",
                "Day 2-5: Continue daily gratitude journaling",
                "Day 6: Share your gratitude practice with a friend or colleague",
                "Day 7: Reflect on how this practice affected your week"
            ]
        },
        {
            title: "Compassionate Listening",
            description: "This week, practice truly listening to others without planning your response. Give full attention and seek to understand.",
            tasks: [
                "Each day, have one conversation where you listen 80% and speak 20%",
                "Notice when your mind wanders to planning responses",
                "Ask clarifying questions instead of giving advice",
                "Reflect on what you learned about the other person"
            ]
        },
        {
            title: "Random Acts of Support",
            description: "Perform one intentional act of kindness each day for a team member or colleague. No recognition needed.",
            tasks: [
                "Compliment specific work someone did well",
                "Help with a task without being asked",
                "Bring coffee or treats for your team",
                "Leave an encouraging note for someone",
                "Volunteer to cover a difficult shift or patient"
            ]
        },
        {
            title: "Mindful Moments",
            description: "Practice being present during one routine task each day. No multitasking, no rushing—just full presence.",
            tasks: [
                "Choose one daily activity (coffee, walking, patient setup)",
                "Do it with complete attention—notice details, sensations, emotions",
                "When your mind wanders, gently bring it back",
                "Notice how this affects your stress and enjoyment"
            ]
        }
    ];

    // Get challenge based on week of year
    const weekOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 604800000);
    const selectedChallenge = challenges[weekOfYear % challenges.length];

    // Build challenge HTML
    const challengeHTML = `
        <h3>${selectedChallenge.title}</h3>
        <p>${selectedChallenge.description}</p>
        <ul class="challenge-list">
            ${selectedChallenge.tasks.map(task => `<li><i class="fas fa-check-circle"></i> ${task}</li>`).join('')}
        </ul>
    `;

    challengeElement.innerHTML = challengeHTML;
}

// ===================================
// SCROLL ANIMATIONS
// ===================================
function initializeScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements that should animate on scroll
    const animateElements = document.querySelectorAll('.philosophy-card, .practice-card, .skill-card, .strategy-card, .principle-card, .conflict-card, .culture-card, .financial-card, .spending-card, .education-card, .planning-card, .takeaway-card');
    
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Add CSS for animation
const style = document.createElement('style');
style.textContent = `
    .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
`;
document.head.appendChild(style);

// ===================================
// SMOOTH SCROLLING
// ===================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===================================
// NAVBAR SCROLL EFFECT
// ===================================
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.boxShadow = '0 1px 0 rgba(0, 0, 0, 0.05)';
    }
    
    lastScroll = currentScroll;
});

// ===================================
// PAGE LOAD ANIMATIONS
// ===================================
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

// Add loading class styles
const loadingStyle = document.createElement('style');
loadingStyle.textContent = `
    body {
        opacity: 0;
        transition: opacity 0.5s ease;
    }
    
    body.loaded {
        opacity: 1;
    }
`;
document.head.appendChild(loadingStyle);
