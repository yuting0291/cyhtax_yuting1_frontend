// ***重要：在這裡貼上您部署 Apps Script 得到的網頁應用程式 URL***
// 這個 URL 應該是您在「第二步：編寫 Google Apps Script」的第 6 點，部署成功後獲得的。
const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzNB2zFQGJrqDTF7VO8yFIDplVvWGcl2BMqw5iC0enPbAm-mwK1pdXIwGxxvAMd2Am6/exec'; // 例如: 'https://script.google.com/macros/s/AKfycbz_YOUR_DEPLOYMENT_ID/exec'

// DOM 元素 (取得網頁上的各種元素，方便 JavaScript 操作)
const toggleViewBtn = document.getElementById('toggleViewBtn'); // 切換視圖按鈕
const registrationSection = document.getElementById('registrationSection'); // 報名區塊
const adminDashboardSection = document.getElementById('adminDashboardSection'); // 主管報名狀況區塊
const messageDisplay = document.getElementById('message'); // 顯示訊息的段落

const departmentSelect = document.getElementById('departmentSelect'); // 科室下拉選單
const divisionSelect = document.getElementById('divisionSelect'); // 股別下拉選單
const employeeNameInput = document.getElementById('employeeName'); // 姓名輸入框
const employeeIdInput = document.getElementById('employeeId'); // 員工編號輸入框
const registrationForm = document.getElementById('registrationForm'); // 報名表單
const submitBtn = document.getElementById('submitBtn'); // 報名送出按鈕
const statusContentDiv = document.getElementById('statusContent'); // 顯示報名狀況的內容區塊

let allDepartmentsAndDivisions = []; // 全域變數，用於儲存從 Apps Script 獲取的所有組織架構資料

// --- 輔助函數 ---
// 顯示訊息給使用者 (成功或錯誤訊息)
function showMessage(msg, isError = false) {
    messageDisplay.textContent = msg; // 設定訊息內容
    messageDisplay.style.display = 'block'; // 顯示訊息區塊
    // 根據是否為錯誤訊息設定背景色和文字顏色
    messageDisplay.style.backgroundColor = isError ? '#ffbaba' : '#d4edda'; // 紅色系是錯誤，綠色系是成功
    messageDisplay.style.color = isError ? '#721c24' : '#155724'; // 錯誤紅色字，成功綠色字
    // 設定計時器，5 秒後自動隱藏訊息
    setTimeout(() => {
        messageDisplay.style.display = 'none';
    }, 5000); // 5 秒 = 5000 毫秒
}

// --- 載入科室和股別資料 (報名表單用) ---
// 這個函數會在網頁載入時執行，從 Apps Script 獲取公司的科室和股別列表
async function loadDepartmentsAndDivisions() {
    try {
        // 向 Apps Script 發送 GET 請求，請求 action=getDepartmentsAndDivisions
        const response = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=getDepartmentsAndDivisions`);
        if (!response.ok) { // 檢查 HTTP 響應是否成功 (例如 200 OK)
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json(); // 解析 JSON 響應
        if (data.error) { // 如果 Apps Script 返回了錯誤訊息
            throw new Error(data.error);
        }
        allDepartmentsAndDivisions = data; // 將獲取的組織架構資料儲存起來

        // 清空並填充科室下拉選單
        departmentSelect.innerHTML = '<option value="">請選擇科室</option>'; // 預設選項
        allDepartmentsAndDivisions.forEach(dep => {
            const option = document.createElement('option');
            option.value = dep.name; // 使用科室名稱作為選項值
            option.textContent = dep.name; // 顯示科室名稱
            departmentSelect.appendChild(option); // 將選項加入到下拉選單
        });
        departmentSelect.disabled = false; // 載入完成後啟用科室選單
    } catch (error) {
        console.error('載入科室股別失敗:', error); // 在控制台輸出錯誤
        showMessage(`載入科室股別失敗: ${error.message}`, true); // 顯示錯誤訊息給使用者
    }
}

// --- 根據科室選取，動態更新股別下拉選單 ---
departmentSelect.addEventListener('change', () => {
    const selectedDepName = departmentSelect.value; // 獲取當前選中的科室名稱
    divisionSelect.innerHTML = '<option value="">請選擇股別</option>'; // 清空股別選單
    divisionSelect.disabled = true; // 預設禁用股別選單

    if (selectedDepName) { // 如果有選中科室
        // 從之前載入的 allDepartmentsAndDivisions 中找到對應的科室
        const department = allDepartmentsAndDivisions.find(dep => dep.name === selectedDepName);
        if (department && department.divisions.length > 0) { // 如果找到了且有股別
            department.divisions.forEach(div => {
                const option = document.createElement('option');
                option.value = div.name; // 使用股別名稱作為選項值
                option.textContent = div.name; // 顯示股別名稱
                divisionSelect.appendChild(option); // 將選項加入到股別下拉選單
            });
            divisionSelect.disabled = false; // 啟用股別選單
        }
    }
});

// --- 處理報名表單提交 ---
registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // 阻止表單的預設提交行為（例如頁面重新載入）

    submitBtn.disabled = true; // 禁用提交按鈕，防止重複提交
    submitBtn.textContent = '報名中...'; // 更改按鈕文字
    showMessage('', false); // 清除可能存在的舊訊息

    // 獲取表單輸入的值
    const employee_id = employeeIdInput.value.trim(); // 員工編號，去除前後空白
    const employee_name = employeeNameInput.value.trim(); // 姓名，去除前後空白
    const division_name = divisionSelect.value; // 選中的股別名稱
    const department_name = departmentSelect.value; // 選中的科室名稱 (前端傳送，後端會再校驗)
    // 獲取選中的便當選項 (葷或素)
    const lunch_option = document.querySelector('input[name="lunchOption"]:checked').value;

    // 基本的表單驗證
    if (!employee_id || !employee_name || !division_name || !lunch_option) {
        showMessage('請填寫所有必填欄位！', true);
        submitBtn.disabled = false;
        submitBtn.textContent = '送出報名';
        return; // 停止執行後續程式碼
    }

    try {
        // 向 Apps Script 發送 POST 請求來提交報名資料
        const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
            method: 'POST', // 設定為 POST 請求
            headers: {
                'Content-Type': 'application/json', // 告訴伺服器發送的是 JSON 資料
            },
            body: JSON.stringify({ // 將資料轉換為