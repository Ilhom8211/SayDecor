/**
 * SayDecor — Клиентское приложение
 * Модуль управления заказами мебельного производства
 * 
 * Функции:
 *   - Динамическое добавление/удаление строк деталей
 *   - Генерация XLSX через SheetJS
 *   - Загрузка файла на сервер
 *   - Отправка Telegram-уведомления
 */

// ─── Состояние приложения ──────────────────────────────
const state = {
  rows: [],       // Массив объектов деталей
  nextId: 1,      // Счётчик уникальных ID строк
  isSubmitting: false
};

// ─── DOM элементы ──────────────────────────────────────
const DOM = {
  customerName: document.getElementById('customerName'),
  phone: document.getElementById('phone'),
  projectName: document.getElementById('projectName'),
  detailsBody: document.getElementById('detailsBody'),
  mobileCards: document.getElementById('mobileCards'),
  addRowBtn: document.getElementById('addRowBtn'),
  submitBtn: document.getElementById('submitBtn'),
  rowCount: document.getElementById('rowCount'),
  successModal: document.getElementById('successModal'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  errorToast: document.getElementById('errorToast'),
  errorToastText: document.getElementById('errorToastText')
};

// ─── Telegram Bot Config (Client-side) ─────────────────
const TELEGRAM_CONFIG = {
  token: '8947406404:AAEkn56qe6-sQoSRTCNH08SiUebVfcmLuxw',
  chatId: '8429326762'
};

// ═══════════════════════════════════════════════════════
//   ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Добавляем первую пустую строку
  addRow();

  // Навешиваем обработчики
  DOM.addRowBtn.addEventListener('click', addRow);
  DOM.submitBtn.addEventListener('click', handleSubmit);
  document.getElementById('downloadBtn').addEventListener('click', handleDownload);
  DOM.modalCloseBtn.addEventListener('click', closeModal);

  // Закрытие модала по клику на оверлей
  DOM.successModal.addEventListener('click', (e) => {
    if (e.target === DOM.successModal) closeModal();
  });

  // Маска телефона
  DOM.phone.addEventListener('input', formatPhone);

  // Установка круглого фавикона
  setupCircularFavicon();
});

// ═══════════════════════════════════════════════════════
//   УПРАВЛЕНИЕ СТРОКАМИ
// ═══════════════════════════════════════════════════════

/**
 * Добавить новую строку детали
 */
function addRow() {
  const row = {
    id: state.nextId++,
    name: 'Деталь',
    length: '',
    width: '',
    qty: '',
    texture: false,
    edgeLength1: false,
    edgeLength2: false,
    edgeWidth1: false,
    edgeWidth2: false
  };

  state.rows.push(row);
  renderRows();
  updateRowCount();

  // Фокус на поле имени новой строки
  requestAnimationFrame(() => {
    const lastInput = document.querySelector(
      `[data-row-id="${row.id}"] .input-name, [data-card-id="${row.id}"] .input-name`
    );
    if (lastInput) lastInput.focus();
  });
}

/**
 * Удалить строку по ID
 */
function deleteRow(id) {
  // Не удаляем если осталась одна строка
  if (state.rows.length <= 1) return;

  state.rows = state.rows.filter(r => r.id !== id);
  renderRows();
  updateRowCount();
  setupCircularFavicon();
}

/**
 * Создание круглого фавикона из логотипа
 */
function setupCircularFavicon() {
  const img = new Image();
  img.src = 'logo.png';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // Рисуем круг
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.clip();
    
    // Зум (чтобы скрыть серый фон оригинала)
    const zoom = 2.5; 
    const size = 64 * zoom;
    const offset = (size - 64) / 2;
    ctx.drawImage(img, -offset, -offset, size, size);
    
    // Обновляем ссылку
    const favicon = document.getElementById('favicon');
    if (favicon) {
      favicon.href = canvas.toDataURL('image/png');
    }
  };
}

/**
 * Обновить значение поля строки
 */
function updateRowField(id, field, value) {
  const row = state.rows.find(r => r.id === id);
  if (row) {
    row[field] = value;
  }
}

/**
 * Валидация конкретного поля при выходе (blur)
 */
function handleBlur(id, field, value) {
  const numValue = value === '' ? null : Number(value);
  if (numValue === null) return;

  let error = '';
  if (field === 'length' && numValue < 50) error = 'Минимальная длина 50 мм';
  if (field === 'width' && numValue < 50) error = 'Минимальная ширина 50 мм';
  if (field === 'qty') {
     if (numValue < 1) error = 'Минимальное количество — 1 шт';
     if (numValue > 99) error = 'Максимальное количество — 99 шт';
  }

  if (error) {
    showToast(error);
    // Находим инпут и вешаем ошибку
    const selector = `[data-row-id="${id}"] .input-${field}, [data-card-id="${id}"] .input-${field}`;
    const inputs = document.querySelectorAll(selector);
    inputs.forEach(input => {
      input.classList.add('is-invalid');
      input.value = ''; // Очищаем как просил юзер
    });
    // Обнуляем в стейте
    updateRowField(id, field, '');
  } else {
    // Убираем ошибку если все ок
    const selector = `[data-row-id="${id}"] .input-${field}, [data-card-id="${id}"] .input-${field}`;
    const inputs = document.querySelectorAll(selector);
    inputs.forEach(input => input.classList.remove('is-invalid'));
  }
}

/**
 * Обновить счётчик строк
 */
function updateRowCount() {
  const count = state.rows.length;
  const text = getDeclension(count, 'деталь', 'детали', 'деталей');
  DOM.rowCount.textContent = `${count} ${text}`;
}

/**
 * Склонение слов по количеству
 */
function getDeclension(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

// ═══════════════════════════════════════════════════════
//   РЕНДЕР СТРОК
// ═══════════════════════════════════════════════════════

/**
 * Опции для выбора наименования детали
 */
const nameOptions = [
  'Деталь', 'Боковина', 'Полка', 'Задняя стенка', 'Стойка', 
  'Цоколь', 'Фасад', 'Крышка', 'Дно', 'Планка'
];

function getNameSelect(id, value) {
  return `
    <select class="table-select input-name" onchange="updateRowField(${id}, 'name', this.value)">
      ${nameOptions.map(opt => `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`).join('')}
    </select>
  `;
}

/**
 * Отрисовать все строки (таблица + мобильные карточки)
 */
function renderRows() {
  renderDesktopRows();
  renderMobileCards();
}

/**
 * Отрисовать строки в таблице (desktop)
 */
function renderDesktopRows() {
  DOM.detailsBody.innerHTML = state.rows.map((row, index) => `
    <tr data-row-id="${row.id}">
      <td class="row-index">${index + 1}</td>
      <td>
        <input
          type="number"
          class="table-input input-length"
          placeholder="мм"
          value="${row.length}"
          min="50"
          oninput="updateRowField(${row.id}, 'length', this.value)"
          onblur="handleBlur(${row.id}, 'length', this.value)"
        >
      </td>
      <td>
        <input
          type="number"
          class="table-input input-width"
          placeholder="мм"
          value="${row.width}"
          min="50"
          oninput="updateRowField(${row.id}, 'width', this.value)"
          onblur="handleBlur(${row.id}, 'width', this.value)"
        >
      </td>
      <td>
        <input
          type="number"
          class="table-input input-qty"
          placeholder="шт"
          value="${row.qty}"
          min="1"
          max="99"
          oninput="updateRowField(${row.id}, 'qty', this.value)"
          onblur="handleBlur(${row.id}, 'qty', this.value)"
        >
      </td>
      <td>
        <div class="edge-toggles">
          <label class="edge-toggle edge-toggle--texture">
            <input
              type="checkbox"
              ${row.texture ? 'checked' : ''}
              onchange="updateRowField(${row.id}, 'texture', this.checked)"
            >
            <div class="edge-toggle__box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          </label>
        </div>
      </td>
      <td>
        <div class="edge-toggles">
          <label class="edge-toggle edge-toggle--l">
            <input
              type="checkbox"
              ${row.edgeLength1 ? 'checked' : ''}
              onchange="updateRowField(${row.id}, 'edgeLength1', this.checked)"
            >
            <div class="edge-toggle__box">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </div>
          </label>
          <label class="edge-toggle edge-toggle--r">
            <input
              type="checkbox"
              ${row.edgeLength2 ? 'checked' : ''}
              onchange="updateRowField(${row.id}, 'edgeLength2', this.checked)"
            >
            <div class="edge-toggle__box">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </label>
        </div>
      </td>
      <td>
        <div class="edge-toggles">
          <label class="edge-toggle edge-toggle--t">
            <input
              type="checkbox"
              ${row.edgeWidth1 ? 'checked' : ''}
              onchange="updateRowField(${row.id}, 'edgeWidth1', this.checked)"
            >
            <div class="edge-toggle__box">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </div>
          </label>
          <label class="edge-toggle edge-toggle--b">
            <input
              type="checkbox"
              ${row.edgeWidth2 ? 'checked' : ''}
              onchange="updateRowField(${row.id}, 'edgeWidth2', this.checked)"
            >
            <div class="edge-toggle__box">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </label>
        </div>
      </td>
      <td>
        ${getNameSelect(row.id, row.name)}
      </td>
      <td>
        <button
          type="button"
          class="btn-delete-row"
          title="Удалить строку"
          onclick="deleteRow(${row.id})"
          ${state.rows.length <= 1 ? 'disabled style="opacity:0.3;cursor:default"' : ''}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Отрисовать мобильные карточки
 */
function renderMobileCards() {
  DOM.mobileCards.innerHTML = state.rows.map((row, index) => `
    <div class="mobile-card" data-card-id="${row.id}">
      <div class="mobile-card__header">
        <span class="mobile-card__number">${index + 1}</span>
        <button
          type="button"
          class="btn-delete-row"
          title="Удалить"
          onclick="deleteRow(${row.id})"
          ${state.rows.length <= 1 ? 'disabled style="opacity:0.3;cursor:default"' : ''}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>

      <div class="mobile-card__grid">
        <div class="mobile-card__field mobile-card__field--full">
          <span class="mobile-card__label">Наименование</span>
          ${getNameSelect(row.id, row.name)}
        </div>

        <div class="mobile-card__field">
          <span class="mobile-card__label">Длина (мм)</span>
          <input
            type="number"
            class="mobile-card__input input-length"
            placeholder="мм"
            value="${row.length}"
            min="50"
            oninput="updateRowField(${row.id}, 'length', this.value)"
            onblur="handleBlur(${row.id}, 'length', this.value)"
          >
        </div>

        <div class="mobile-card__field">
          <span class="mobile-card__label">Ширина (мм)</span>
          <input
            type="number"
            class="mobile-card__input input-width"
            placeholder="мм"
            value="${row.width}"
            min="50"
            oninput="updateRowField(${row.id}, 'width', this.value)"
            onblur="handleBlur(${row.id}, 'width', this.value)"
          >
        </div>

        <div class="mobile-card__field">
          <span class="mobile-card__label">Количество</span>
          <input
            type="number"
            class="mobile-card__input input-qty"
            placeholder="шт"
            value="${row.qty}"
            min="1"
            max="99"
            oninput="updateRowField(${row.id}, 'qty', this.value)"
            onblur="handleBlur(${row.id}, 'qty', this.value)"
          >
        </div>

          <div class="mobile-card__check-item">
            <span class="mobile-card__check-label">Текстура:</span>
            <div class="edge-toggles">
              <label class="edge-toggle edge-toggle--texture">
                <input
                  type="checkbox"
                  ${row.texture ? 'checked' : ''}
                  onchange="updateRowField(${row.id}, 'texture', this.checked)"
                >
                <div class="edge-toggle__box">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              </label>
            </div>
          </div>

        <div class="mobile-card__checks">
          <div class="mobile-card__check-item">
            <span class="mobile-card__check-label">Кромка длина:</span>
            <div class="edge-toggles">
              <label class="edge-toggle edge-toggle--l">
                <input
                  type="checkbox"
                  ${row.edgeLength1 ? 'checked' : ''}
                  onchange="updateRowField(${row.id}, 'edgeLength1', this.checked)"
                >
                <div class="edge-toggle__box">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </div>
              </label>
              <label class="edge-toggle edge-toggle--r">
                <input
                  type="checkbox"
                  ${row.edgeLength2 ? 'checked' : ''}
                  onchange="updateRowField(${row.id}, 'edgeLength2', this.checked)"
                >
                <div class="edge-toggle__box">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
              </label>
            </div>
          </div>

          <div class="mobile-card__check-item">
            <span class="mobile-card__check-label">Кромка ширина:</span>
            <div class="edge-toggles">
              <label class="edge-toggle edge-toggle--t">
                <input
                  type="checkbox"
                  ${row.edgeWidth1 ? 'checked' : ''}
                  onchange="updateRowField(${row.id}, 'edgeWidth1', this.checked)"
                >
                <div class="edge-toggle__box">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                </div>
              </label>
              <label class="edge-toggle edge-toggle--b">
                <input
                  type="checkbox"
                  ${row.edgeWidth2 ? 'checked' : ''}
                  onchange="updateRowField(${row.id}, 'edgeWidth2', this.checked)"
                >
                <div class="edge-toggle__box">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════
//   ГЕНЕРАЦИЯ XLSX
// ═══════════════════════════════════════════════════════

/**
 * Сгенерировать XLSX файл из данных формы
 * @returns {Blob} - XLSX файл в виде Blob
 */
function generateXLSX() {
  const customerName = DOM.customerName.value.trim();
  const phone = DOM.phone.value.trim();
  const projectName = DOM.projectName.value.trim();

  // Формируем данные для Excel
  const data = [];

  // ── Заголовок с информацией о заказчике ──
  data.push(['Имя заказчика', customerName || '']);
  data.push(['Телефон', phone || '']);
  data.push(['Название проекта', projectName || '']);
  data.push([]); // Пустая строка-разделитель

  // ── Заголовки таблицы ──
  data.push([
    'Длина (мм)',
    'Ширина (мм)',
    'Количество',
    'Текстура',
    'Кромка длина-1',
    'Кромка длина-2',
    'Кромка ширина-1',
    'Кромка ширина-2',
    'Наименование детали'
  ]);

  // ── Данные строк ──
  state.rows.forEach(row => {
    data.push([
      row.length ? Number(row.length) : '',        // Длина
      row.width ? Number(row.width) : '',          // Ширина
      row.qty ? Number(row.qty) : '',              // Количество
      row.texture ? 1 : '',                       // Текстура
      row.edgeLength1 ? 1 : '',                   // Кромка длина-1
      row.edgeLength2 ? 1 : '',                   // Кромка длина-2
      row.edgeWidth1 ? 1 : '',                    // Кромка ширина-1
      row.edgeWidth2 ? 1 : '',                    // Кромка ширина-2
      row.name || ''                              // Наименование
    ]);
  });

  // Создаём рабочую книгу
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // ── Настройка ширины столбцов ──
  ws['!cols'] = [
    { wch: 14 },  // Длина
    { wch: 14 },  // Ширина
    { wch: 12 },  // Количество
    { wch: 18 },  // Текстура
    { wch: 15 },  // Кромка длина-1
    { wch: 15 },  // Кромка длина-2
    { wch: 15 },  // Кромка ширина-1
    { wch: 15 },  // Кромка ширина-2
    { wch: 25 }   // Наименование детали
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Заказ');

  // Генерируем файл
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/octet-stream'
  });
}

// ═══════════════════════════════════════════════════════
//   ОБРАБОТКА ОТПРАВКИ ЗАКАЗА
// ═══════════════════════════════════════════════════════

/**
 * Главный обработчик кнопки «Заказать»
 */
async function handleSubmit(event) {
  if (event) event.preventDefault();
  if (state.isSubmitting) return;

  try {
    state.isSubmitting = true;
    setSubmitLoading(true);

    const validationError = validateForm();
    if (validationError) throw new Error(validationError);

    const blob = generateXLSX();
    const customerName = DOM.customerName.value.trim();
    const phone = DOM.phone.value.trim();
    const projectName = DOM.projectName.value.trim();

    const caption = [
      '<b>📦 Новый заказ (SayDecor)</b>',
      '',
      `👤 <b>Заказчик:</b> ${customerName || '—'}`,
      `📞 <b>Телефон:</b> ${phone || '—'}`,
      `🏗️ <b>Проект:</b> ${projectName || '—'}`
    ].join('\n');

    // Отправляем ТОЛЬКО в Telegram. Никаких download здесь!
    await sendTelegramFile(blob, generateFilename(), caption);

    showModal();
  } catch (error) {
    console.error('Submit error:', error);
    showToast(error.message || 'Ошибка. Проверьте интернет или GitHub Push');
  } finally {
    state.isSubmitting = false;
    setSubmitLoading(false);
  }
}

// ═══════════════════════════════════════════════════════
//   API ФУНКЦИИ
// ═══════════════════════════════════════════════════════

/**
 * Отправить документ (XLSX) в Telegram напрямую через API
 */
async function sendTelegramFile(blob, filename, caption) {
  const url = `https://api.telegram.org/bot${TELEGRAM_CONFIG.token}/sendDocument`;
  
  const formData = new FormData();
  formData.append('chat_id', TELEGRAM_CONFIG.chatId);
  formData.append('document', blob, filename);
  formData.append('caption', caption);
  formData.append('parse_mode', 'HTML');

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.description || 'Ошибка отправки файла в Telegram');
  }

  return data;
}

// ═══════════════════════════════════════════════════════
//   УТИЛИТЫ
// ═══════════════════════════════════════════════════════

/**
 * Скачать Blob как файл
 */
function downloadBlob(blob, filename) {
  // Используем специальный тип для мобильных, чтобы принудительно скачать
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  
  // Добавляем в DOM для совместимости с Firefox/Safari
  document.body.appendChild(a);
  
  // Имитируем клик
  a.click();
  
  // Небольшая задержка перед удалением и очисткой памяти
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Сгенерировать имя файла для скачивания
 */
function generateFilename() {
  const project = DOM.projectName.value.trim() || 'заказ';
  const customer = DOM.customerName.value.trim();
  const date = new Date().toISOString().split('T')[0];
  
  // Очищаем имя файла от запрещённых символов
  const safeName = (customer ? `${project}_${customer}` : project)
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 60);

  return `${safeName}_${date}.xlsx`;
}

/**
 * Экранирование HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Форматирование телефона
 */
function formatPhone(e) {
  let value = e.target.value.replace(/\D/g, '');
  
  if (value.length === 0) {
    e.target.value = '';
    return;
  }

  // Начинаем с +7
  if (value[0] === '8') {
    value = '7' + value.substring(1);
  }
  if (value[0] !== '7') {
    value = '7' + value;
  }

  let formatted = '+7';
  if (value.length > 1) formatted += ' (' + value.substring(1, 4);
  if (value.length > 4) formatted += ') ' + value.substring(4, 7);
  if (value.length > 7) formatted += '-' + value.substring(7, 9);
  if (value.length > 9) formatted += '-' + value.substring(9, 11);

  e.target.value = formatted;
}

/**
 * Валидация данных формы
 */
function validateForm() {
  const customerName = DOM.customerName.value.trim();
  const phone = DOM.phone.value.trim();

  if (!customerName) return 'Введите имя заказчика';
  if (!phone || phone.length < 18) return 'Введите корректный номер телефона';

  for (let i = 0; i < state.rows.length; i++) {
    const row = state.rows[i];
    const rowNum = i + 1;

    // Если строка полностью пустая - пропускаем (или требуем заполнения если это единственная строка)
    if (!row.length && !row.width && !row.qty && state.rows.length > 1) continue;

    if (!row.length || Number(row.length) < 50) {
      return `Строка ${rowNum}: Минимальная длина 50 мм`;
    }
    if (!row.width || Number(row.width) < 50) {
      return `Строка ${rowNum}: Минимальная ширина 50 мм`;
    }
    if (!row.qty || Number(row.qty) < 1) {
      return `Строка ${rowNum}: Минимальное количество — 1 шт`;
    }
    if (Number(row.qty) > 99) {
      return `Строка ${rowNum}: Максимальное количество — 99 шт`;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════
//   UI HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Показать/скрыть индикатор загрузки на кнопке
 */
function setSubmitLoading(loading) {
  const btnText = DOM.submitBtn.querySelector('.btn__text');
  const btnLoader = DOM.submitBtn.querySelector('.btn__loader');

  if (loading) {
    btnText.hidden = true;
    btnLoader.hidden = false;
    DOM.submitBtn.disabled = true;
  } else {
    btnText.hidden = false;
    btnLoader.hidden = true;
    DOM.submitBtn.disabled = false;
  }
}

/**
 * Показать модал успеха
 */
function showModal() {
  DOM.successModal.hidden = false;
  // Принудительный reflow для анимации
  DOM.successModal.offsetHeight;
  DOM.successModal.classList.add('is-visible');
  document.body.style.overflow = 'hidden';
}

/**
 * Закрыть модал
 */
function closeModal() {
  DOM.successModal.classList.remove('is-visible');
  setTimeout(() => {
    DOM.successModal.hidden = true;
    document.body.style.overflow = '';
  }, 300);
}

/**
 * Показать тост с ошибкой
 */
function showToast(message) {
  console.log('Showing toast:', message);
  DOM.errorToastText.textContent = message;
  
  // Reset state
  DOM.errorToast.hidden = false;
  DOM.errorToast.classList.remove('is-visible');
  
  // Trigger reflow
  void DOM.errorToast.offsetWidth;
  
  // Show
  DOM.errorToast.classList.add('is-visible');

  // Clear existing timeout if any
  if (DOM.errorToast.timeoutId) {
    clearTimeout(DOM.errorToast.timeoutId);
  }

  DOM.errorToast.timeoutId = setTimeout(() => {
    DOM.errorToast.classList.remove('is-visible');
    setTimeout(() => {
      DOM.errorToast.hidden = true;
    }, 400);
  }, 5000);
}

/**
 * Обработчик кнопки «Скачать файл»
 */
function handleDownload() {
  try {
    const blob = generateXLSX();
    downloadBlob(blob, generateFilename());
  } catch (error) {
    showToast('Ошибка при скачивании файла');
  }
}
