// ===================================
// GEMINI AI CHATBOT
// ===================================

// ⚠️ 중요: 여기에 실제 Google AI Studio API 키를 넣으세요
// https://aistudio.google.com/apikey 에서 발급받을 수 있습니다
const GEMINI_API_KEY = "YOUR_GEMINI_KEY_HERE";  // 👈 여기를 실제 API 키로 교체하세요!

// ✅ 2026년 최신 모델 사용
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const connectionStatus = document.getElementById('connection-status');

// System Prompt - Dr. Chi의 페르소나
const SYSTEM_CONTEXT = `당신은 Dr. Chi의 AI 어시스턴트입니다. 
Dr. Chi는 치과 전문의이자 임상 디렉터로, "Better Than Yesterday (bty)" 철학을 통해 치과 전문가들의 성장을 돕습니다.

핵심 가치:
- 자기 사랑 (Self-Love): 자신을 받아들이고 성장하기
- 연민 (Compassion): 타인을 이해하고 돕기
- 성장 마인드셋 (Growth Mindset): 매일 조금씩 나아지기

답변할 수 있는 주제:
1. 임상 기술 (치과 시술, 술기 향상)
2. 환자 관리 (치료 계획 설명, 불만 처리)
3. 팀 관계 (스태프와의 협력, 갈등 해결)
4. 재정 조언 (지출 관리, 투자, 장기 계획)
5. 마인드셋 및 자기 계발

답변 스타일:
- 친근하고 공감적인 톤
- 구체적이고 실용적인 조언
- 필요시 단계별 가이드 제공
- 한국어로 자연스럽게 답변`;

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🤖 Chatbot initialized");
    console.log("📦 Using model: gemini-2.5-flash");
    
    // Check API Key
    if (GEMINI_API_KEY === "YOUR_API_KEY_HERE") {
        showError("⚠️ API 키가 설정되지 않았습니다. js/chatbot.js 파일에서 GEMINI_API_KEY를 설정해주세요.");
        sendButton.disabled = true;
        connectionStatus.textContent = "API 키 필요";
        connectionStatus.parentElement.querySelector('.status-dot').style.background = '#ef4444';
        return;
    }

    console.log("🔑 API Key configured");
    
    // Event Listeners
    sendButton.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    });
});

// ===================================
// SEND MESSAGE
// ===================================
async function handleSendMessage() {
    const message = userInput.value.trim();
    
    if (!message) return;
    
    console.log("📤 Sending message:", message);
    
    // Display user message
    addMessage(message, 'user');
    
    // Clear input
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // Disable send button
    sendButton.disabled = true;
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Call Gemini API
        const response = await callGeminiAPI(message);
        
        // Remove typing indicator
        removeTypingIndicator();
        
        // Display bot response
        addMessage(response, 'bot');
        
        console.log("✅ Response received");
        
    } catch (error) {
        console.error("❌ Error:", error);
        removeTypingIndicator();
        
        let errorMessage = "죄송합니다. 일시적인 오류가 발생했습니다.";
        
        if (error.message.includes("API key not valid")) {
            errorMessage = "API 키가 유효하지 않습니다. Google AI Studio에서 새 키를 발급받아주세요.";
        } else if (error.message.includes("404")) {
            errorMessage = "모델을 찾을 수 없습니다. 코드가 최신 버전인지 확인해주세요.";
        } else if (error.message.includes("429")) {
            errorMessage = "API 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
        }
        
        addMessage(errorMessage, 'bot');
        showError("API 오류: " + error.message);
    } finally {
        sendButton.disabled = false;
        userInput.focus();
    }
}

// ===================================
// CALL GEMINI API
// ===================================
async function callGeminiAPI(userMessage) {
    console.log("🔄 Calling Gemini API...");
    
    // Build conversation with system context
    const prompt = `${SYSTEM_CONTEXT}\n\n사용자 질문: ${userMessage}\n\n답변:`;
    
    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    };
    
    console.log("📦 Sending request to:", GEMINI_API_URL.split('?')[0]);
    
    const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });
    
    console.log("📥 Response status:", response.status);
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ API Error:", errorData);
        throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    console.log("📊 Response received successfully");
    
    // Extract reply
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        const reply = data.candidates[0].content.parts[0].text;
        return reply;
    } else {
        console.error("Invalid response format:", data);
        throw new Error("Invalid response format from API");
    }
}

// ===================================
// UI FUNCTIONS
// ===================================
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = sender === 'bot' 
        ? '<i class="fas fa-robot"></i>' 
        : '<i class="fas fa-user"></i>';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Format text with line breaks
    const formattedText = text.split('\n').map(line => 
        line.trim() ? `<p>${line}</p>` : ''
    ).join('');
    contentDiv.innerHTML = formattedText || `<p>${text}</p>`;
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message';
    typingDiv.id = 'typing-indicator';
    
    typingDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const inputContainer = document.querySelector('.chat-input-container');
    inputContainer.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// ===================================
// LOGGING FOR DEBUGGING
// ===================================
console.log("🔑 API Key set:", GEMINI_API_KEY !== "YOUR_API_KEY_HERE");
console.log("🌐 API Endpoint configured");
