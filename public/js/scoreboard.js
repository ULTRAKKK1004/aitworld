const motivationPhrases = [
    "당신의 최고 기록을 경신해보세요!",
    "라이벌이 당신을 추격하고 있습니다!",
    "정상을 향한 도전은 계속됩니다!",
    "단 한 판으로 순위가 바뀔 수 있습니다!",
    "조금만 더 하면 순위가 올라가요!",
    "오늘의 주인공은 바로 당신입니다!",
    "경쟁은 성장의 밑거름입니다!",
    "포기하지 마세요, 거의 다 왔습니다!",
    "당신의 한계를 시험해 보세요!"
];

function updateLeaderboard(gameType) {
    // Try to detect gameType from URL if not provided
    if (!gameType) {
        const path = window.location.pathname;
        if (path.includes('brick-crasher')) gameType = 'brick';
        else if (path.includes('hero-quest')) gameType = 'hero';
        else if (path.includes('airplane-shooter')) gameType = 'airplane-shooter';
        else if (path.includes('mc-world')) gameType = 'mc-world';
    }

    const url = gameType ? `/api/leaderboard?gameType=${gameType}` : '/api/leaderboard';
    
    fetch(url)
        .then(res => res.json())
        .then(data => {
            renderTop10(data.top10);
            renderRivals(data.rivals);
            document.getElementById('my-rank').innerText = data.userRank || '-';
        });
}

function renderTop10(top10) {
    const container = document.getElementById('top10');
    container.innerHTML = top10.map((user, index) => `
        <div class="leader-item">
            <span class="rank">${index + 1}</span>
            <span class="name">${user.username}</span>
            <span class="score">${user.best_score.toLocaleString()}</span>
        </div>
    `).join('');
}

function renderRivals(rivals) {
    const container = document.getElementById('rivals');
    container.innerHTML = rivals.map(user => `
        <div class="leader-item ${user.rank === parseInt(document.getElementById('my-rank').innerText) ? 'current-user' : ''}">
            <span class="rank">${user.rank}</span>
            <span class="name">${user.username}</span>
            <span class="score">${user.best_score.toLocaleString()}</span>
        </div>
    `).join('');
}

function updateMotivation() {
    const container = document.getElementById('motivation');
    const randomPhrase = motivationPhrases[Math.floor(Math.random() * motivationPhrases.length)];
    container.innerText = randomPhrase;
}

// Initialize
updateLeaderboard();
updateMotivation();
setInterval(updateMotivation, 10000); // Change phrase every 10 seconds

window.updateLeaderboard = updateLeaderboard;
