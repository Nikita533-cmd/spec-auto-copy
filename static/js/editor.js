document.addEventListener("DOMContentLoaded", function() {
  const canvas = document.getElementById('editor-canvas');
  const ctx = canvas.getContext('2d');

  // Состояние редактора
  let currentTool = 'select'; // select, node, connection, delete
  let nodes = [];
  let connections = [];
  let selectedNode = null;
  let connectionStart = null;
  let dragging = false;
  let dragOffset = { x: 0, y: 0 };
  let nodeIdCounter = 1;

  // Класс для узла
  class Node {
    constructor(x, y, type = 'sprinkler') {
      this.id = nodeIdCounter++;
      this.x = x;
      this.y = y;
      this.type = type;
      this.radius = 15;
      this.label = `${this.getTypeLabel()} ${this.id}`;
      this.properties = {
        length: 0,
        diameter: 0
      };
    }

    getTypeLabel() {
      const labels = {
        'sprinkler': 'О',
        'junction': 'У',
        'pump': 'Н'
      };
      return labels[this.type] || 'У';
    }

    draw(ctx, isSelected = false) {
      ctx.save();

      // Тень для выбранного узла
      if (isSelected) {
        ctx.shadowColor = '#0d6efd';
        ctx.shadowBlur = 10;
      }

      // Рисуем круг
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

      // Цвет в зависимости от типа
      const colors = {
        'sprinkler': '#ff6b6b',
        'junction': '#4ecdc4',
        'pump': '#45b7d1'
      };
      ctx.fillStyle = colors[this.type] || '#4ecdc4';
      ctx.fill();

      ctx.strokeStyle = isSelected ? '#0d6efd' : '#333';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Текст внутри
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.getTypeLabel(), this.x, this.y);

      // Подпись
      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.fillText(this.label, this.x, this.y + this.radius + 12);

      ctx.restore();
    }

    contains(x, y) {
      const dx = x - this.x;
      const dy = y - this.y;
      return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }
  }

  // Класс для соединения
  class Connection {
    constructor(nodeA, nodeB) {
      this.nodeA = nodeA;
      this.nodeB = nodeB;
      this.id = `${nodeA.id}-${nodeB.id}`;
    }

    draw(ctx) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.nodeA.x, this.nodeA.y);
      ctx.lineTo(this.nodeB.x, this.nodeB.y);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Стрелка
      const angle = Math.atan2(this.nodeB.y - this.nodeA.y, this.nodeB.x - this.nodeA.x);
      const arrowSize = 10;
      const midX = (this.nodeA.x + this.nodeB.x) / 2;
      const midY = (this.nodeA.y + this.nodeB.y) / 2;

      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(
        midX - arrowSize * Math.cos(angle - Math.PI / 6),
        midY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        midX - arrowSize * Math.cos(angle + Math.PI / 6),
        midY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  // Функция отрисовки
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем соединения
    connections.forEach(conn => conn.draw(ctx));

    // Рисуем узлы
    nodes.forEach(node => {
      const isSelected = selectedNode === node;
      node.draw(ctx, isSelected);
    });

    // Рисуем временное соединение
    if (connectionStart && currentTool === 'connection') {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(connectionStart.x, connectionStart.y);
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(mouseX - rect.left, mouseY - rect.top);
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Обработка кликов по инструментам
  document.querySelectorAll('[id^="tool-"]').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[id^="tool-"]').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentTool = this.id.replace('tool-', '');
      connectionStart = null;
      selectedNode = null;

      // Меняем курсор
      const cursors = {
        'select': 'default',
        'node': 'crosshair',
        'connection': 'pointer',
        'delete': 'not-allowed'
      };
      canvas.style.cursor = cursors[currentTool] || 'default';

      render();
    });
  });

  // Сохранение позиции мыши
  let mouseX = 0, mouseY = 0;
  canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Обработка кликов на canvas
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedNode = nodes.find(node => node.contains(x, y));

    if (currentTool === 'select' && clickedNode) {
      selectedNode = clickedNode;
      dragging = true;
      dragOffset.x = x - clickedNode.x;
      dragOffset.y = y - clickedNode.y;
      showProperties(clickedNode);
    } else if (currentTool === 'node' && !clickedNode) {
      const nodeType = document.getElementById('node-type').value;
      const newNode = new Node(x, y, nodeType);
      nodes.push(newNode);
      selectedNode = newNode;
      showProperties(newNode);
    } else if (currentTool === 'connection') {
      if (!connectionStart && clickedNode) {
        connectionStart = clickedNode;
      } else if (connectionStart && clickedNode && connectionStart !== clickedNode) {
        // Проверяем, нет ли уже такого соединения
        const exists = connections.some(conn =>
          (conn.nodeA === connectionStart && conn.nodeB === clickedNode) ||
          (conn.nodeA === clickedNode && conn.nodeB === connectionStart)
        );
        if (!exists) {
          connections.push(new Connection(connectionStart, clickedNode));
        }
        connectionStart = null;
      }
    } else if (currentTool === 'delete') {
      if (clickedNode) {
        // Удаляем узел и все связанные соединения
        nodes = nodes.filter(n => n !== clickedNode);
        connections = connections.filter(conn =>
          conn.nodeA !== clickedNode && conn.nodeB !== clickedNode
        );
        selectedNode = null;
        hideProperties();
      }
    }

    render();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (dragging && selectedNode && currentTool === 'select') {
      const rect = canvas.getBoundingClientRect();
      selectedNode.x = e.clientX - rect.left - dragOffset.x;
      selectedNode.y = e.clientY - rect.top - dragOffset.y;
      render();
    }
  });

  canvas.addEventListener('mouseup', () => {
    dragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    dragging = false;
  });

  // Отображение свойств узла
  function showProperties(node) {
    const panel = document.getElementById('properties-panel');
    const content = document.getElementById('properties-content');

    content.innerHTML = `
      <div class="mb-2">
        <label class="form-label"><strong>ID:</strong> ${node.id}</label>
      </div>
      <div class="mb-2">
        <label class="form-label"><strong>Тип:</strong></label>
        <select class="form-select form-select-sm" id="prop-type">
          <option value="sprinkler" ${node.type === 'sprinkler' ? 'selected' : ''}>Ороситель</option>
          <option value="junction" ${node.type === 'junction' ? 'selected' : ''}>Узел</option>
          <option value="pump" ${node.type === 'pump' ? 'selected' : ''}>Насос</option>
        </select>
      </div>
      <div class="mb-2">
        <label class="form-label">Название:</label>
        <input type="text" class="form-control form-control-sm" id="prop-label" value="${node.label}">
      </div>
      <button class="btn btn-primary btn-sm mt-2" id="apply-props">Применить</button>
    `;

    document.getElementById('apply-props').addEventListener('click', () => {
      node.type = document.getElementById('prop-type').value;
      node.label = document.getElementById('prop-label').value;
      render();
    });

    panel.style.display = 'block';
  }

  function hideProperties() {
    document.getElementById('properties-panel').style.display = 'none';
  }

  // Очистка canvas
  document.getElementById('clear-canvas').addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите очистить canvas?')) {
      nodes = [];
      connections = [];
      selectedNode = null;
      connectionStart = null;
      nodeIdCounter = 1;
      hideProperties();
      render();
    }
  });

  // Экспорт данных
  document.getElementById('export-data').addEventListener('click', () => {
    const data = {
      nodes: nodes.map(node => ({
        id: node.id,
        x: node.x,
        y: node.y,
        type: node.type,
        label: node.label,
        properties: node.properties
      })),
      connections: connections.map(conn => ({
        from: conn.nodeA.id,
        to: conn.nodeB.id
      }))
    };

    console.log('Exported data:', data);
    alert('Данные экспортированы в консоль. Откройте DevTools для просмотра.');
  });

  // Начальная отрисовка
  render();
});
