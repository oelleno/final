
document.addEventListener("DOMContentLoaded", function () {
    /* 펜 기능을 위한 캔버스 생성 및 설정 */
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    canvas.id = "drawingCanvas";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.zIndex = "99";
    canvas.style.pointerEvents = "none";
    canvas.style.display = "none";

    /* 캔버스 드로잉 컨텍스트 및 변수 초기화 */
    const ctx = canvas.getContext("2d");
    let lines = [];
    let isDrawing = false;
    let lastPoint = null;
    const fadeOutDuration = 10000;
    let penActive = false;

    /* 펜 버튼 생성 및 스타일 설정 */
    const penButton = document.createElement("button");
    penButton.innerText = "🖊️";
    penButton.style.position = "fixed";
    penButton.style.right = "10px";
    penButton.style.top = "50%";
    penButton.style.transform = "translateY(-50%)";
    penButton.style.padding = "10px 15px";
    penButton.style.backgroundColor = "#FFD700";
    penButton.style.color = "black";
    penButton.style.border = "none";
    penButton.style.borderRadius = "8px";
    penButton.style.cursor = "pointer";
    penButton.style.zIndex = "100";
    penButton.style.fontSize = "20px";
    penButton.style.fontWeight = "bold";
    penButton.style.transition = "background-color 0.2s ease";
    document.body.appendChild(penButton);

    /* 펜 버튼 클릭 이벤트 처리 - 펜 활성화/비활성화 토글 */
    penButton.addEventListener("click", () => {
        penActive = !penActive;
        if (penActive) {
            canvas.style.display = "block"; 
            canvas.style.pointerEvents = "auto"; 
            penButton.style.backgroundColor = "#FFA500"; 
        } else {
            canvas.style.display = "none"; 
            canvas.style.pointerEvents = "none"; 
            penButton.style.backgroundColor = "#FFD700"; 
        }
    });

    /* 화면 크기 변경 시 캔버스 크기 조정 함수 */
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    window.addEventListener("resize", resizeCanvas);

    /* 마우스/터치 포인트 좌표 가져오기 함수 */
    function getPoint(e) {
        if (e.type.includes("touch")) {
            return {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        }
        return {
            x: e.clientX,
            y: e.clientY
        };
    }

    /* 그리기 시작 함수 */
    function startDrawing(e) {
        if (!penActive) return;

        e.preventDefault();
        isDrawing = true;
        lastPoint = getPoint(e);
        lines.push({ points: [lastPoint], opacity: 0.7, startTime: Date.now() });
        draw(e);
    }

    /* 그리기 함수 - 마우스/터치 이동에 따라 선 그리기 */
    function draw(e) {
        if (!isDrawing || !penActive) return;

        e.preventDefault();
        const point = getPoint(e);

        if (lines.length > 0 && lastPoint) {
            const lastLine = lines[lines.length - 1];
            lastLine.points.push(point);
        }

        lastPoint = point;
        drawLines();
    }

    /* 모든 선 그리기 함수 - 캔버스에 저장된 모든 선을 렌더링 */
    function drawLines() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        lines.forEach(line => {
            if (line.points.length < 2) return;

            ctx.beginPath();
            ctx.moveTo(line.points[0].x, line.points[0].y);

            for (let i = 1; i < line.points.length; i++) {
                ctx.lineTo(line.points[i].x, line.points[i].y);
            }

            ctx.strokeStyle = `rgba(255, 255, 0, ${line.opacity})`;
            ctx.lineWidth = 12;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke();
        });
    }

    /* 그리기 중단 함수 */
    function stopDrawing() {
        isDrawing = false;
    }

    /* 애니메이션 함수 - 시간 경과에 따라 선 페이드아웃 */
    function animate() {
        const currentTime = Date.now();
        
        // 모든 선 opacity 계산 및 0 이하인 선 필터링 - 한번에 처리
        lines = lines.filter(line => {
            const elapsed = currentTime - line.startTime;
            const newOpacity = Math.max(0, 0.7 - elapsed / fadeOutDuration);
            line.opacity = newOpacity;
            return newOpacity > 0;
        });
        
        // 변경된 데이터로 한번만 렌더링
        drawLines();
        requestAnimationFrame(animate);
    }

    /* 마우스 이벤트 리스너 등록 */
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);

    /* 터치 이벤트 리스너 등록 */
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDrawing);
    canvas.addEventListener("touchcancel", stopDrawing);

    /* 애니메이션 시작 */
    animate();
});
