// 팝업 표시 함수
function showBranchManagerPopup() {
  // 이미 선택된 경우 팝업 표시하지 않음
  if (document.getElementById('branch').value && document.getElementById('contract_manager').value) {
    return;
  }

  // CSS 스타일 추가
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @keyframes shimmer {
        0% {
            background-position: 200% 0;
        }

        100% {
            background-position: -200% 0;
        }
    }

    .logo-container {
        position: relative;
        display: inline-block;
    }

    .logo-container::after {
        content: "";
        position: absolute;
        top: -3px;
        left: -3px;
        right: -3px;
        bottom: -3px;
        background: linear-gradient(90deg,
                rgba(192, 192, 192, 0) 0%,
                rgba(192, 192, 192, 0.1) 20%,
                rgba(211, 211, 211, 0.5) 50%,
                rgba(192, 192, 192, 0.1) 80%,
                rgba(192, 192, 192, 0) 100%);
        background-size: 200% 100%;
        border-radius: 10px;
        z-index: 1;
        animation: shimmer 5s infinite linear;
        pointer-events: none;
    }

    .branch-popup {
        border-radius: 15px;
        box-shadow: 0 0 20px rgba(0,0,0,0.3);
        padding: 2rem;
    }

    .branch-popup-select {
        width: 100%;
        padding: 12px;
        margin-bottom: 15px;
        border-radius: 5px;
        border: 1px solid #ced4da;
        font-size: 14px;
        color: white;
        background-color: #2b3035;
        font-weight: bold;
    }

    .branch-popup-btn {
        width: 100%;
        margin-top: 15px;
        padding: 12px;
        font-size: 16px;
        background: #0078D7;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
    }
  `;
  document.head.appendChild(styleTag);

  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #212529;
    padding: 30px;
    border-radius: 15px;
    box-shadow: 0 0 20px rgba(0,0,0,0.3);
    z-index: 1000;
    width: 280px;
    font-size: 16px;
    text-align: center;
  `;
  popup.className = 'branch-popup';

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

  // 로고 추가
  const logoContainer = document.createElement('div');
  logoContainer.className = 'logo-container';
  logoContainer.style.cssText = 'text-align: center; margin-bottom: 30px;';

  const logoImg = document.createElement('img');
  logoImg.src = 'BDSR.png';
  logoImg.alt = 'BDSR 로고';
  logoImg.style.cssText = 'max-width: 150px; margin: 20px 10px; position: relative; z-index: 2;';

  logoContainer.appendChild(logoImg);
  popup.appendChild(logoContainer);

  // 지점 선택 컨테이너
  const branchContainer = document.createElement('div');
  branchContainer.style.marginBottom = '15px';

  // 지점 선택 드롭다운 복제
  const branchSelect = document.createElement('select');
  branchSelect.className = 'branch-popup-select';
  branchSelect.style.cssText = `
    width: 220px;
    padding: 8px 12px;
    margin-bottom: 15px;
    border-radius: 5px;
    border: 1px solid #ced4da;
    font-size: 14px;
    color: white;
    background-color: #2b3035;
    font-weight: bold;
  `;
  
  // 드롭다운 너비 조정을 위한 추가 CSS
  const dropdownFixStyle = document.createElement('style');
  dropdownFixStyle.textContent = `
    select.branch-popup-select option {
      width: 220px;
      box-sizing: border-box !important;
      max-width: 220px !important;
      padding: 16px 20px !important;
      height: auto !important;
      min-height: 48px !important;
      font-size: 18px !important;
      line-height: 1.6 !important;
    }
    
    .branch-popup-select {
      width: 220px;
    }
  `;
  document.head.appendChild(dropdownFixStyle);

  // 기존 지점 드롭다운의 옵션을 복제
  const originalBranchSelect = document.getElementById('branch');
  if (originalBranchSelect) {
    Array.from(originalBranchSelect.options).forEach(option => {
      branchSelect.add(new Option(option.text, option.value));
    });
  }

  branchContainer.appendChild(branchSelect);
  popup.appendChild(branchContainer);

  // 담당자 선택 컨테이너
  const managerContainer = document.createElement('div');
  managerContainer.style.marginBottom = '25px';

  // 담당자 선택 드롭다운
  const managerSelect = document.createElement('select');
  managerSelect.className = 'branch-popup-select';
  managerSelect.style.cssText = `
    width: 220px;
    padding: 8px 12px;
    margin-bottom: 15px;
    border-radius: 5px;
    border: 1px solid #ced4da;
    font-size: 14px;
    color: white;
    background-color: #2b3035;
    font-weight: bold;
  `;

  // 기본 옵션 추가
  managerSelect.add(new Option('담당자 선택', ''));

  managerContainer.appendChild(managerSelect);
  popup.appendChild(managerContainer);

  // 지점 선택 시 담당자 목록 업데이트
  branchSelect.addEventListener('change', function() {
    // 담당자 드롭다운 초기화
    while (managerSelect.options.length > 1) {
      managerSelect.remove(1);
    }

    const selectedBranch = branchSelect.value;
    if (!selectedBranch) return;

    // 원본 지점 드롭다운에서 매니저 데이터 가져오기
    const managersData = originalBranchSelect.getAttribute(`data-managers-${selectedBranch}`);
    if (managersData) {
      const managers = JSON.parse(managersData);

      // 매니저 옵션 추가
      Object.entries(managers).forEach(([index, name]) => {
        if (name && typeof name === 'string') {
          managerSelect.add(new Option(name, name));
        }
      });
    }
  });

  // 확인 버튼
  const confirmButton = document.createElement('button');
  confirmButton.textContent = '선택 완료';
  confirmButton.className = 'branch-popup-btn';
  confirmButton.style.cssText = `
    width: 220px;
    margin-top: 15px;
    height: 44px; /* Match the select height including padding */
    font-size: 16px;
    background: #0078D7;
    color: white;
    border: 2px solid white;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.3s;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.7);
  `;

  confirmButton.onmouseover = function() {
    this.style.backgroundColor = '#0056b3';
    this.style.borderColor = 'white';
    this.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.9)';
  };

  confirmButton.onmouseout = function() {
    this.style.backgroundColor = '#0078D7';
    this.style.borderColor = 'white';
    this.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.7)';
  };

  confirmButton.onclick = function() {
    if (!branchSelect.value) {
      alert('지점을 선택해주세요.');
      return;
    }

    if (!managerSelect.value) {
      alert('담당자를 선택해주세요.');
      return;
    }

    // 원본 드롭다운에 선택값 적용
    originalBranchSelect.value = branchSelect.value;

    // 담당자 선택 업데이트 (이벤트 트리거 방식)
    const event = new Event('change');
    originalBranchSelect.dispatchEvent(event);

    // 원본 담당자 드롭다운에 선택값 적용
    const originalManagerSelect = document.getElementById('contract_manager');
    if (originalManagerSelect) {
      setTimeout(() => {
        originalManagerSelect.value = managerSelect.value;
        // 담당자 선택 변경 이벤트 발생시키기 (폼 데이터 업데이트 용)
        const event = new Event('change');
        originalManagerSelect.dispatchEvent(event);
        console.log("계약 담당자가 설정되었습니다:", managerSelect.value);
      }, 100);
    }

    // 팝업 닫기
    document.body.removeChild(overlay);
    document.body.removeChild(popup);
  };

  popup.appendChild(confirmButton);
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
}

// 페이지 로드 시 팝업 표시
document.addEventListener('DOMContentLoaded', function() {
  // 지점 및 담당자 데이터가 로드된 후 팝업 표시
  setTimeout(() => {
    showBranchManagerPopup();
  }, 1000);
});


function showDiscountPopup() {
  // 정상가격 로드 확인
  if (!window.normalPrices) {
    // Firestore에서 설정이 아직 로드되지 않은 경우 기본값 설정
    window.normalPrices = {
      dailyPrice: 5000,
      freePTPrice: 50000,
      gxPrice: 30000
    };
  }

  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 0 20px rgba(0,0,0,0.3);
    z-index: 1000;
    width: 280px;
    font-size: 16px;
  `;

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
}