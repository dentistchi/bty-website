'use strict';

// ========== 질문 데이터베이스 ==========
const questionDatabase = {
    // Part 1: 핵심 자존감 (RSES Core) - 가중치 30%
    core: {
        section: "핵심 자존감",
        weight: 0.30,
        questions: [
            { id: 1, text: "나는 내가 다른 사람들처럼 가치 있는 사람이라고 생각한다", reverse: false },
            { id: 2, text: "나는 좋은 성품을 가졌다고 생각한다", reverse: false },
            { id: 3, text: "나는 대체적으로 실패한 사람이라는 느낌이 든다", reverse: true },
            { id: 4, text: "나는 대부분의 다른 사람들과 같이 일을 잘 할 수 있다", reverse: false },
            { id: 5, text: "나는 자랑할 것이 별로 없다", reverse: true },
            { id: 6, text: "나는 나 자신에 대하여 긍정적인 태도를 가지고 있다", reverse: false },
            { id: 7, text: "나는 나 자신에 대하여 대체로 만족한다", reverse: false },
            { id: 8, text: "나는 나 자신을 좀 더 존중할 수 있으면 좋겠다", reverse: true },
            { id: 9, text: "나는 가끔 내 자신이 쓸모없는 사람이라는 느낌이 든다", reverse: true },
            { id: 10, text: "나는 때때로 내가 좋지 않은 사람이라고 생각한다", reverse: true }
        ]
    },
    
    // Part 2: 자기자비 - 가중치 20%
    compassion: {
        section: "자기자비",
        weight: 0.20,
        questions: [
            { id: 11, text: "실수했을 때, 나는 나 자신에게 친절하게 대한다", reverse: false },
            { id: 12, text: "힘들 때 나는 스스로를 따뜻하게 위로한다", reverse: false },
            { id: 13, text: "나의 단점을 생각하면 다른 사람들과 단절된 느낌이 든다", reverse: true },
            { id: 14, text: "고통스러운 감정이 들 때, 그것을 있는 그대로 바라본다", reverse: false },
            { id: 15, text: "실패했을 때, 나는 내 자신을 가혹하게 비난한다", reverse: true },
            { id: 16, text: "모든 사람이 때로는 부족함을 느낀다는 것을 이해한다", reverse: false },
            { id: 17, text: "나는 나 자신의 가장 큰 응원자다", reverse: false },
            { id: 18, text: "속상할 때, 스스로에게 '괜찮아'라고 말해준다", reverse: false },
            { id: 19, text: "내 문제는 나만의 문제인 것 같아 외롭다", reverse: true },
            { id: 20, text: "어려울 때, 내가 필요한 것을 스스로에게 준다", reverse: false }
        ]
    },
    
    // Part 3: 조건부 vs 진정한 자존감 - 가중치 20%
    stability: {
        section: "자존감의 안정성",
        weight: 0.20,
        questions: [
            { id: 21, text: "성공했을 때만 나 자신이 가치 있다고 느낀다", reverse: true },
            { id: 22, text: "다른 사람이 나를 칭찬할 때만 기분이 좋다", reverse: true },
            { id: 23, text: "실패해도 나의 가치는 변하지 않는다", reverse: false },
            { id: 24, text: "외모나 능력과 관계없이 나는 소중하다", reverse: false },
            { id: 25, text: "타인의 평가가 나의 자존감을 크게 흔든다", reverse: true },
            { id: 26, text: "나는 무엇을 하든 존재 자체로 가치 있다", reverse: false },
            { id: 27, text: "좋은 성적을 받지 못하면 나는 쓸모없다고 느낀다", reverse: true },
            { id: 28, text: "나의 가치는 나의 성취와 별개다", reverse: false },
            { id: 29, text: "누군가와 비교당할 때마다 내 가치가 흔들린다", reverse: true },
            { id: 30, text: "나는 '있는 그대로의 나'로 충분하다", reverse: false }
        ]
    },
    
    // Part 4: 성장 마인드셋 - 가중치 15%
    growth: {
        section: "성장 가능성 믿음",
        weight: 0.15,
        questions: [
            { id: 31, text: "나의 능력은 노력으로 얼마든지 향상될 수 있다", reverse: false },
            { id: 32, text: "실패는 나에게 배움의 기회다", reverse: false },
            { id: 33, text: "내 지능은 타고나는 것이라 바꿀 수 없다", reverse: true },
            { id: 34, text: "어려운 과제는 나를 더 성장시킨다", reverse: false },
            { id: 35, text: "나는 계속해서 발전하는 사람이다", reverse: false },
            { id: 36, text: "새로운 것을 배우는 과정이 즐겁다", reverse: false },
            { id: 37, text: "비판은 나를 더 나은 사람으로 만드는 정보다", reverse: false },
            { id: 38, text: "내 성격은 거의 바꿀 수 없다", reverse: true },
            { id: 39, text: "실수는 나의 성장을 증명하는 흔적이다", reverse: false },
            { id: 40, text: "나는 1년 후 지금보다 더 나아질 것이다", reverse: false }
        ]
    },
    
    // Part 5: 사회적 자존감 - 가중치 15%
    social: {
        section: "관계 속 나",
        weight: 0.15,
        questions: [
            { id: 41, text: "나는 다른 사람들과 함께 있을 때 편안하다", reverse: false },
            { id: 42, text: "사람들이 나를 좋아하지 않을까봐 걱정된다", reverse: true },
            { id: 43, text: "나는 내 의견을 자신있게 표현한다", reverse: false },
            { id: 44, text: "다른 사람들 앞에서 나 자신이 되기가 어렵다", reverse: true },
            { id: 45, text: "나는 관계에서 내 가치를 인정받고 있다고 느낀다", reverse: false },
            { id: 46, text: "나는 다른 사람들에게 부담이 된다고 생각한다", reverse: true },
            { id: 47, text: "사람들은 진짜 나를 알면 실망할 것이다", reverse: true },
            { id: 48, text: "나는 타인과의 관계에서 당당하다", reverse: false },
            { id: 49, text: "혼자 있어도 나는 괜찮은 사람이다", reverse: false },
            { id: 50, text: "나는 사랑받을 자격이 있는 사람이다", reverse: false }
        ]
    }
};

// ========== 전역 변수 ==========
let currentQuestionIndex = 0;
let answers = [];
let responseTimes = [];
let questionStartTime = 0;
let allQuestions = [];
let scores = {};

// ========== 초기화 ==========
function init() {
    // 모든 질문을 하나의 배열로 합치기
    allQuestions = [
        ...questionDatabase.core.questions,
        ...questionDatabase.compassion.questions,
        ...questionDatabase.stability.questions,
        ...questionDatabase.growth.questions,
        ...questionDatabase.social.questions
    ];
    
    // 답변 배열 초기화
    answers = Array(50).fill(0);
    responseTimes = Array(50).fill(0);
}

// ========== 테스트 시작 ==========
function startTest() {
    init();
    showPage('question-page');
    displayQuestion();
}

// ========== 페이지 전환 ==========
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
    window.scrollTo(0, 0);
}

// ========== 질문 표시 ==========
function displayQuestion() {
    const question = allQuestions[currentQuestionIndex];
    const sectionNames = [
        "Part 1: 핵심 자존감",
        "Part 2: 자기자비",
        "Part 3: 자존감의 안정성",
        "Part 4: 성장 가능성 믿음",
        "Part 5: 관계 속 나"
    ];
    const sectionIndex = Math.floor(currentQuestionIndex / 10);
    
    // 진행률 업데이트
    const progress = ((currentQuestionIndex + 1) / 50) * 100;
    document.getElementById('progress-bar').style.width = progress + '%';
    document.getElementById('progress-text').textContent = `${currentQuestionIndex + 1} / 50`;
    document.getElementById('section-text').textContent = sectionNames[sectionIndex];
    
    // 질문 표시
    document.getElementById('question-number').textContent = `Q${currentQuestionIndex + 1}`;
    document.getElementById('question-title').textContent = question.text;
    
    // 답변 선택 초기화
    document.querySelectorAll('.answer-option').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // 이전 답변이 있으면 표시
    if (answers[currentQuestionIndex] > 0) {
        const container = document.querySelector('.answers-container');
        const selectedBtn = container.querySelector(`[data-value="${answers[currentQuestionIndex]}"]`);
        if (selectedBtn) selectedBtn.classList.add('selected');
    }
    
    // 이전 버튼 표시/숨김
    const backBtn = document.getElementById('btn-back');
    if (currentQuestionIndex === 0) {
        backBtn.style.display = 'none';
    } else {
        backBtn.style.display = 'block';
    }

    questionStartTime = Date.now();
}

// ========== 답변 선택 ==========
function selectAnswer(value) {
    answers[currentQuestionIndex] = value;
    
    // 응답 시간 기록
    const responseTime = (Date.now() - questionStartTime) / 1000; // 초 단위
    responseTimes[currentQuestionIndex] = responseTime;

    // 선택 표시
    document.querySelectorAll('.answer-option').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // HTML onclick에서 발생한 이벤트 처리 (안전한 접근)
    const e = window.event;
    if (e && e.target) e.target.closest('.answer-option').classList.add('selected');
    
    // 0.6초 후 다음 질문으로
    setTimeout(() => {
        currentQuestionIndex++;
        
        if (currentQuestionIndex >= 50) {
            // 모든 질문 완료
            calculateResults();
        } else {
            displayQuestion();
        }
    }, 600);
}

// ========== 이전 질문 ==========
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

// ========== 결과 계산 ==========
function calculateResults() {
    // 각 섹션별 점수 계산
    scores = {
        core: calculateSectionScore(0, 10, questionDatabase.core.questions),
        compassion: calculateSectionScore(10, 20, questionDatabase.compassion.questions),
        stability: calculateSectionScore(20, 30, questionDatabase.stability.questions),
        growth: calculateSectionScore(30, 40, questionDatabase.growth.questions),
        social: calculateSectionScore(40, 50, questionDatabase.social.questions)
    };
    
    // 가중 평균 계산
    const totalScore = (
        scores.core * questionDatabase.core.weight +
        scores.compassion * questionDatabase.compassion.weight +
        scores.stability * questionDatabase.stability.weight +
        scores.growth * questionDatabase.growth.weight +
        scores.social * questionDatabase.social.weight
    );
    
    scores.total = totalScore;
    
    // 프로파일 분류
    scores.profile = classifyProfile(scores);
    
    // 결과 페이지로 이동
    displayPreviewResults();
}

function calculateSectionScore(start, end, questions) {
    let score = 0;
    
    for (let i = start; i < end; i++) {
        const questionIndex = i - start;
        const question = questions[questionIndex];
        const answer = answers[i];
        
        if (question.reverse) {
            score += (5 - answer); // 역문항 처리
        } else {
            score += answer;
        }
    }
    
    // 0-100 범위로 정규화
    return (score / 40) * 100;
}

function classifyProfile(scores) {
    if (scores.total >= 75 && scores.stability >= 70) {
        return {
            name: "단단한 뿌리",
            emoji: "🌳",
            description: "진정한 자존감을 가진 당신"
        };
    } else if (scores.stability < 50) {
        return {
            name: "흔들리는 빛",
            emoji: "✨",
            description: "외부 평가에 민감한 당신"
        };
    } else if (scores.compassion < 45) {
        return {
            name: "자기비판가",
            emoji: "🔍",
            description: "스스로에게 엄격한 당신"
        };
    } else if (scores.growth >= 70) {
        return {
            name: "성장하는 나무",
            emoji: "🌱",
            description: "끊임없이 발전하는 당신"
        };
    } else if (scores.social < 50) {
        return {
            name: "조용한 관찰자",
            emoji: "🌙",
            description: "관계에서 조심스러운 당신"
        };
    } else {
        return {
            name: "균형 탐색자",
            emoji: "⚖️",
            description: "조화를 찾아가는 당신"
        };
    }
}

// ========== 결과 미리보기 표시 ==========
function displayPreviewResults() {
    showPage('preview-result-page');
    
    // 총점 애니메이션
    animateScore('preview-total-score', scores.total, 2000);
    animateCircle(scores.total / 100);
    
    // 점수에 따른 색상 테마 업데이트
    updateScoreVisuals(scores.total);
    
    // 점수 해석
    const interpretation = getScoreInterpretation(scores.total);
    document.getElementById('preview-interpretation').textContent = interpretation;
    
    // 프로파일 유형 정보 업데이트 (아이콘, 제목, 설명)
    if (scores.profile) {
        document.querySelector('.result-icon').textContent = scores.profile.emoji;
        document.querySelector('.result-title').textContent = `당신의 유형: ${scores.profile.name}`;
        document.querySelector('.result-subtitle').textContent = scores.profile.description;
    }
    
    // 세부 점수 애니메이션
    setTimeout(() => {
        animateBar('bar-core', scores.core);
        animateBar('bar-compassion', scores.compassion);
        animateBar('bar-stability', scores.stability);
        animateBar('bar-growth', scores.growth);
        animateBar('bar-social', scores.social);
        
        document.getElementById('score-core').textContent = Math.round(scores.core) + '점';
        document.getElementById('score-compassion').textContent = Math.round(scores.compassion) + '점';
        document.getElementById('score-stability').textContent = Math.round(scores.stability) + '점';
        document.getElementById('score-growth').textContent = Math.round(scores.growth) + '점';
        document.getElementById('score-social').textContent = Math.round(scores.social) + '점';
    }, 500);
    
    // 폼에 데이터 설정
    setFormData();
}

// ========== 점수별 시각화 업데이트 ==========
function updateScoreVisuals(score) {
    const gradient = document.getElementById('gradient');
    const stops = gradient.getElementsByTagName('stop');
    const scoreNumber = document.getElementById('preview-total-score');
    
    let colorStart, colorEnd;

    if (score >= 70) {
        // 높음: 초록/청록 계열 (건강함)
        colorStart = '#48bb78'; // Green
        colorEnd = '#38a169';   // Dark Green
    } else if (score >= 40) {
        // 중간: 주황/노랑 계열 (주의)
        colorStart = '#f6ad55'; // Orange
        colorEnd = '#ed8936';   // Dark Orange
    } else {
        // 낮음: 빨강/분홍 계열 (위험)
        colorStart = '#fc8181'; // Red
        colorEnd = '#e53e3e';   // Dark Red
    }

    // SVG 그라데이션 업데이트
    stops[0].style.stopColor = colorStart;
    stops[1].style.stopColor = colorEnd;
    
    // 점수 텍스트 그라데이션 업데이트
    scoreNumber.style.backgroundImage = `linear-gradient(135deg, ${colorStart}, ${colorEnd})`;
}

function animateScore(elementId, targetScore, duration) {
    let currentScore = 0;
    const increment = targetScore / (duration / 16);
    const element = document.getElementById(elementId);
    
    const interval = setInterval(() => {
        currentScore += increment;
        if (currentScore >= targetScore) {
            currentScore = targetScore;
            clearInterval(interval);
        }
        element.textContent = Math.round(currentScore);
    }, 16);
}

function animateCircle(percentage) {
    const circle = document.getElementById('score-circle-preview');
    const circumference = 2 * Math.PI * 90;
    const offset = circumference * (1 - percentage);
    
    setTimeout(() => {
        circle.style.transition = 'stroke-dashoffset 2s ease';
        circle.style.strokeDashoffset = offset;
    }, 100);
}

function animateBar(elementId, score) {
    const bar = document.getElementById(elementId);
    setTimeout(() => {
        bar.style.width = score + '%';
    }, 100);
}

function getScoreInterpretation(score) {
    if (score >= 80) return "매우 건강한 자존감 ⭐⭐⭐";
    if (score >= 65) return "건강한 자존감 ⭐⭐";
    if (score >= 50) return "보통 수준의 자존감 ⭐";
    if (score >= 35) return "낮은 자존감 - 개선 필요";
    return "매우 낮은 자존감 - 전문가 상담 권장";
}

// ========== 폼 데이터 설정 ==========
function setFormData() {
    document.getElementById('form-total-score').value = Math.round(scores.total);
    document.getElementById('form-core-score').value = Math.round(scores.core);
    document.getElementById('form-compassion-score').value = Math.round(scores.compassion);
    document.getElementById('form-stability-score').value = Math.round(scores.stability);
    document.getElementById('form-growth-score').value = Math.round(scores.growth);
    document.getElementById('form-social-score').value = Math.round(scores.social);
    document.getElementById('form-profile-type').value = scores.profile.name;
    document.getElementById('form-answers').value = JSON.stringify(answers);
}

// ========== 폼 제출 처리 ==========
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('email-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // 이메일 유효성 검사
            const emailInput = form.querySelector('input[name="email"]');
            const emailValue = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!emailValue || !emailRegex.test(emailValue)) {
                alert('올바른 이메일 형식을 입력해주세요.');
                emailInput.focus();
                return;
            }

            // 버튼 로딩 상태 표시
            const submitBtn = form.querySelector('.btn-submit');
            const originalBtnText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = '분석 보고서 생성 중...';
            
            // Google Apps Script URL 사용 (HTML form의 action 속성)
            fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
            })
            .then(response => response.json())
            .then(data => {
                // Google Apps Script 응답 처리 ({"result":"success"})
                if (data.result === 'success') {
                    showPage('thank-you-page');
                } else {
                    alert('오류가 발생했습니다. 다시 시도해주세요.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
            })
            .finally(() => {
                // 버튼 상태 복구
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            });
        });
    }
});

// ========== 다시 시작 ==========
function restartTest() {
    if (confirm('처음부터 다시 시작하시겠습니까?')) {
        currentQuestionIndex = 0;
        answers = [];
        scores = {};
        showPage('landing-page');
    }
}

// ========== 초기화 ==========
window.addEventListener('load', function() {
    // 랜딩 페이지 표시
    showPage('landing-page');
});