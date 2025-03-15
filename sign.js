var dictationCanvas = null;
var dictationCtx = null;
var isDrawing = false;
var lastX = 0;
var lastY = 0;

/* 서명 캔버스 초기화 및 팝업 생성 함수 - 사용자가 서명할 수 있는 캔버스 팝업을 생성 */
function initDictationCanvas(targetWord, callback) {
  /* 팝업 창 요소 생성 */
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 0 10px rgba(0,0,0,0.3);
    z-index: 1000;
  `;

  /* 배경 오버레이 생성 */
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 999;
  `;

  /* 서명 캔버스 생성 및 스타일 설정 */
  dictationCanvas = document.createElement('canvas');
  dictationCanvas.width = 400;
  dictationCanvas.height = 200;
  dictationCanvas.style.cssText = `
    border: 1px solid #ccc;
    background: white;
  `;

  /* 서명 가이드 텍스트 생성 */
  const guideText = document.createElement('div');
  const popupWidth = Math.min(window.innerWidth * 0.8, 800);
  const fontSize = Math.floor(popupWidth * 0.06);
  guideText.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #ccc;
    font-size: ${fontSize}px;
    pointer-events: none;
    width: 100%;
    text-align: center;
  `;
  guideText.textContent = targetWord;

  /* 지우기 버튼 생성 */
  const clearBtn = document.createElement('button');
  clearBtn.textContent = '지우기';
  clearBtn.style.cssText = `
    display: inline-block;
    margin: 10px 5px 0;
    padding: 5px 20px;
    border: none;
    background: #4CAF50;
    color: white;
    border-radius: 5px;
    cursor: pointer;
  `;

  /* 서명 완료 버튼 생성 */
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '서명 완료';
  closeBtn.style.cssText = `
    display: inline-block;
    margin: 10px 5px 0;
    padding: 5px 20px;
    border: none;
    background: #0078D7;
    color: white;
    border-radius: 5px;
    cursor: pointer;
  `;

  /* 버튼 컨테이너 생성 및 버튼 추가 */
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    text-align: center;
  `;
  buttonContainer.appendChild(clearBtn);
  buttonContainer.appendChild(closeBtn);

  /* 팝업에 요소들 추가 및 문서에 팝업 추가 */
  popup.appendChild(dictationCanvas);
  popup.appendChild(guideText);
  popup.appendChild(buttonContainer);
  document.body.appendChild(overlay);
  document.body.appendChild(popup);

  /* 캔버스 드로잉 컨텍스트 설정 */
  dictationCtx = dictationCanvas.getContext('2d');
  dictationCtx.strokeStyle = '#000000';
  dictationCtx.lineWidth = 5;
  dictationCtx.lineCap = 'round';

  /* 그리기 함수 - 사용자가 드래그할 때 선을 그림 */
  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const rect = dictationCanvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    dictationCtx.beginPath();
    dictationCtx.moveTo(lastX, lastY);
    dictationCtx.lineTo(x, y);
    dictationCtx.stroke();

    [lastX, lastY] = [x, y];
  }

  /* 그리기 시작 함수 - 마우스 또는 터치 이벤트로 그리기 시작 */
  function startDrawing(e) {
    isDrawing = true;
    const rect = dictationCanvas.getBoundingClientRect();
    lastX = (e.clientX || e.touches[0].clientX) - rect.left;
    lastY = (e.clientY || e.touches[0].clientY) - rect.top;
  }

  /* 그리기 중단 함수 - 마우스 버튼을 뗄 때 그리기 중단 */
  function stopDrawing() {
    isDrawing = false;
  }

  /* 마우스 이벤트 리스너 등록 */
  dictationCanvas.addEventListener('mousedown', startDrawing);
  dictationCanvas.addEventListener('mousemove', draw);
  dictationCanvas.addEventListener('mouseup', stopDrawing);
  dictationCanvas.addEventListener('mouseleave', stopDrawing);

  /* 터치 이벤트 리스너 등록 */
  dictationCanvas.addEventListener('touchstart', startDrawing);
  dictationCanvas.addEventListener('touchmove', draw);
  dictationCanvas.addEventListener('touchend', stopDrawing);

  /* 지우기 버튼 클릭 이벤트 처리 */
  clearBtn.addEventListener('click', () => {
    dictationCtx.clearRect(0, 0, dictationCanvas.width, dictationCanvas.height);
    // 이미 저장된 서명은 유지하도록 콜백 호출 방지
    if (event) {
      event.stopPropagation();
    }
  });

  /* 서명 완료 버튼 클릭 이벤트 처리 */
  closeBtn.addEventListener('click', () => {
    if (callback) {
      /* 캔버스 이미지를 데이터 URL로 변환 */
      const imageData = dictationCanvas.toDataURL();

      /* 임시 캔버스를 사용하여 이미지 크기 조정 */
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      const img = new Image();

      img.onload = function() {
        /* 서명이 들어갈 텍스트 요소의 크기에 맞춰 이미지 조정 */
        const textElement = document.querySelector('.dictation-text[data-text="' + targetWord + '"]');
        const rect = textElement.getBoundingClientRect();

        tempCanvas.width = rect.width;
        tempCanvas.height = rect.height;

        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

        /* 조정된 이미지를 콜백함수로 전달 */
        callback(tempCanvas.toDataURL());
      };

      img.src = imageData;
    }
    /* 팝업 및 오버레이 제거 */
    document.body.removeChild(overlay);
    document.body.removeChild(popup);
  });
}
