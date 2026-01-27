document.addEventListener("DOMContentLoaded", function() {
  // форма //
  const
   formAutoUpdateItems = document.querySelectorAll(".auto-update"),
   form = document.querySelector('#calc-form'),
   otvEl = document.querySelector('#otv'),
   resultsBlock = document.querySelector('#results-block'),
   otvOptions = Array.from(otvEl.children),
   skladHeightEl = document.querySelector('#sklad_height'),
   skladHeightBlockEl = document.querySelector('#sklad_height_slider_block'),
   mountingPositionEl = document.querySelector('#mounting_position'),
   thermalLockEl = document.querySelector('#thermal_lock');

  let
   is_form_submited = true,
   pwork_meter_value = 0,
   sprinkler_K_value = 0,
   Q_value = 0,
   inlet_pressure_value = 0

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    is_form_submited = true
    calculate(true)    
  })

  form.addEventListener('reset', (event) => {
    drop_results()
    is_form_submited = false
  })

  formAutoUpdateItems.forEach((elem) => elem.addEventListener("change", () => {
    calculate(is_form_submited)
  }))

  function calculate(show_results){
    const 
      data = new FormData(form),
      values = Object.fromEntries(data.entries()),
      skladHeightEnableValues = ["5", "6", "7"],
      showSkladHeight = skladHeightEnableValues.includes(values.group);

    // управляем полем с высотой склада
    skladHeightEl.disabled = !showSkladHeight
    if(showSkladHeight){
      skladHeightBlockEl.classList.remove("d-none")
    } else {
      skladHeightBlockEl.classList.add("d-none")
    }

    // управляем видом отв
    otvOptions.forEach(el => el.classList.remove("d-none"))
    if(values.group == "1"){
      otvOptions.forEach(el => {
        if(el.value == "foam") {
          el.classList.add("d-none")
          if(values.otv == "foam"){
            otvOptions[0].selected = "selected"
            values.otv = "water"
          }
        }
      })
    }
    if(values.group == "4.2"){
      otvOptions.forEach(el => {
        if(el.value == "water") {
          el.classList.add("d-none")
          if(values.otv == "water"){
            otvOptions[1].selected = "selected"
            values.otv = "foam"
          }
        }
        if(el.value == "water_plus") {
          el.classList.add("d-none")
          if(values.otv == "water_plus"){
            otvOptions[1].selected = "selected"
            values.otv = "foam"
          }
        }
      })
    }
    values.thermal_lock = thermalLockEl?thermalLockEl.value:""
    values.mounting_position = mountingPositionEl?mountingPositionEl.value:""

    if(show_results) getCaclulationResults(values)
  }

  // вызываем расчет при дефолтных параметрах
  calculate()

  async function getCaclulationResults(data) {
    try {
      const response = await fetch("/api/irrigation/intensity/", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {"Content-Type": "application/json"},
      });
      if (!response.ok) throw new Error(`Response status: ${response.status}`)
      const json = await response.json()
      show_results(json)
    } catch (error) {
      console.error(error.message)
      show_results({})
    }
  }

  function show_results(data){
    const
        sprinklers_select = document.querySelector('#sprinklers-select'),
        intensityEl = document.querySelector('#intensity'),
        Q_el = document.querySelector('#Q_el'),
        duration_el = document.querySelector('#duration_el'),
        S_el = document.querySelector('#S_el'),
        H =  document.querySelector('#H'),
        Q1 =  document.querySelector('#Q1'),
        sprinkler_K =  document.querySelector('#sprinkler_K'),
        distance_el = document.querySelector('#distance_el')

    sprinklers_select.innerHTML = '<option></option>';
    if (data.sprinklers && Array.isArray(data.sprinklers)) {
      data.sprinklers.forEach(sprinkler => {
        let new_sprinkler_html = `<option value="${sprinkler.id}" data-pwork="${sprinkler.p_work}" data-K="${sprinkler.K}">${sprinkler.name}</option>`
        sprinklers_select.innerHTML += new_sprinkler_html
      })
    }

    intensityEl.innerHTML = data.required_irrigation_intensity ? `не менее ${data.required_irrigation_intensity} дм³/(с·м²)` : ""
    Q_el.innerHTML = data.Q ? `не менее ${data.Q} л/с` : ""
    duration_el.innerHTML = data.duration_min ? `не менее ${data.duration_min} мин.` : ""
    distance_el.innerHTML = data.distance_max ? `${data.distance_max} м` : ""
    S_el.innerHTML = data.S ? `${data.S} м²` : ""


    sprinklers_select.addEventListener("change", function() {
      const
        selectedOption = this.options[this.selectedIndex],
        pwork = selectedOption.dataset.pwork,
        K = selectedOption.dataset.k,
        sprinklerId = selectedOption.value

        if(pwork){
        const
          pwork_meter = pwork * 101.971625,
          Q = 0.47 * Math.sqrt(pwork_meter)

        pwork_meter_value = pwork_meter
        Q_value = Q
        // K уже в правильных единицах для расчета с метрами
        sprinkler_K_value = K
        H.innerHTML = `${pwork_meter.toFixed(2)} м`
        Q1.innerHTML = `${Q.toFixed(2)} л/с`
        sprinkler_K.innerHTML = `${K} дм3/(с ‧ МПа0,5)`

        // Показываем график для выбранного оросителя
        if (sprinklerId) {
          show_graph(sprinklerId)
        }
      } else {
        // Если ороситель не выбран, скрываем график
        drop_graph()
      }
    })

  }

  // Обработчик для давления на входе насоса
  const inletPressureInput = document.getElementById('inlet-pressure-input')
  if (inletPressureInput) {
    inletPressureInput.addEventListener('change', function() {
      inlet_pressure_value = parseFloat(this.value) || 0
      calculatePumpRequirements()
    })
  }

  function drop_results(){
    const
        graph_container_el = document.querySelector('#graph-container'),
        results_block_el = document.querySelector('#results-block'),
        sprinklers_block_el = document.querySelector('#sprinklers-block'),
        sprinklers_list_el = document.querySelector('#sprinklers-list tbody');

    sprinklers_list_el.innerHTML = ''
    sprinklers_block_el.classList.add("d-none")
    results_block_el.classList.add("d-none")
    graph_container_el.classList.add("d-none")
    drop_graph()
  }

  // Глобальная переменная для хранения графика оросителя
  let sprinklerChart = null

  function drop_graph(){
    // удаляем старый график, если он есть //
    if (sprinklerChart) {
      sprinklerChart.destroy()
      sprinklerChart = null
    }

    // Скрываем контейнер графика
    const chartContainer = document.getElementById('sprinkler-chart-container')
    if (chartContainer) {
      chartContainer.classList.add('d-none')
    }
  }

  async function show_graph(sprinkler_id){
    // график //

    drop_graph()

    try {
      const response = await fetch(`/api/irrigation/graph-data/${sprinkler_id}/`)
      if (!response.ok) throw new Error(`Response status: ${response.status}`)
      const
        json = await response.json(),
        datapoints = [],
        labels = [];

      json.data.forEach(el => {
        labels.push(el.P)
        datapoints.push(el.intensity)
      })

      const data = {
        labels: labels,
        datasets: [
          {
            data: datapoints,
            borderColor: "#0F1379",
            pointRadius: 0,
            cubicInterpolationMode: 'monotone',
            tension: 1,
          }]
      };

      const config = {
        type: 'line',
        data: data,
        options: {
          animation: false,
          responsive: true,
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Давление P, МПа'
              },
              suggestedMin: 0,
              grid: {
                lineWidth: 1,
                color: function(context) {
                  return context.tick.label ? "#aaa" : "#ccc"
                },
              },
              ticks: {
                callback: function(val, index) {
                  const floatVal = parseFloat(this.getLabelForValue(val))
                  return Math.round(floatVal*100) % 10 === 0 ? floatVal : '';
                },
                autoSkip: false,
              }
            },
            y: {
              display: true,
              title: {
                display: true,
                text: 'Интенсивность, дм³/(с·м²)'
              },
              suggestedMin: 0,
              grid: {
                lineWidth: 1,
                color: function(context) {
                  const floatVal = parseFloat(context.tick.label.replace(",", "."))
                  return Math.round(floatVal*100) % 10 === 0 ? "#aaa" : "#ccc";
                },
              },
              ticks: {
                autoSkip: true,
                maxTicksLimit: 15,
              }
            },
          },
          plugins: {
            legend: {
              display: false,
            },
          },
        },
      };

      const chart_el = document.getElementById('sprinkler-chart')
      if (chart_el) {
        sprinklerChart = new Chart(chart_el, config)

        // Показываем контейнер графика
        const chartContainer = document.getElementById('sprinkler-chart-container')
        if (chartContainer) {
          chartContainer.classList.remove('d-none')
        }
      }
    } catch (error) {
      console.error(error.message)
    }
  }


  // Инициализация для каждой ветви //
  const kt_values = {} // Хранение kt для каждой ветви
  const connection_kt_values = {} // Хранение kt для каждого соединения
  const branch_results = {} // Хранение результатов расчёта для каждой ветви
  const branchCalculateFunctions = {} // Хранение функций расчета для каждой ветви
  const connectionCalculateFunctions = {} // Хранение функций расчета соединений
  let branchCounter = 3 // Начинаем с 3, так как уже есть 3 ветви

  // Функция для триггера пересчета соединения
  function triggerConnectionRecalculation(branchNum) {
    // Пересчитываем соединение для текущей ветви
    if (connectionCalculateFunctions[branchNum]) {
      connectionCalculateFunctions[branchNum]()
    }

    // Пересчитываем соединение для предыдущей ветви (если эта ветвь является правой в соединении)
    const prevConnectionNum = branchNum - 1
    if (connectionCalculateFunctions[prevConnectionNum]) {
      connectionCalculateFunctions[prevConnectionNum]()
    }
  }

  // Функция для получения буквы по номеру (1->А, 2->Б, 3->В и т.д.)
  function getBranchLetter(num) {
    const letters = ['а', 'б', 'в', 'г', 'д', 'е', 'ж', 'з', 'и', 'к', 'л', 'м', 'н', 'о', 'п', 'р', 'с', 'т', 'у', 'ф', 'х', 'ц', 'ч', 'ш', 'щ', 'э', 'ю', 'я']
    return letters[num - 1] || num.toString()
  }

  // Функция для создания HTML контента соединения
  function createConnectionHTML(connectionNum) {
    return `
      <form id="calc-form-connection-${connectionNum}">
        <div class="row">
          <div class="col-md-6">
            <div class="row my-4">
              <label for="group" class="col-sm-8 col-form-label">Длина соединения между ветвями, м</label>
              <div class="col-sm-4">
                <input type="number" class="form-control connection-length" id="connection-length-${connectionNum}" required min="0" step="0.1" value="0">
              </div>
            </div>
          </div>
        </div>

        <div class="row tube-params-block" id="tube-params-block-connection-${connectionNum}" style="display: none;">
          <div class="col-md-6">
            <div class="row my-4">
              <label for="group" class="col-sm-4 col-form-label">Тип трубы</label>
              <div class="col-sm-8">
                <select class="form-select" name="TubeType" id="TubeType-connection-${connectionNum}">
                  <option value=""></option>
                </select>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="row my-4">
              <label for="group" class="col-sm-4 col-form-label">Параметры трубы</label>
              <div class="col-sm-8">
                <select class="form-select" id="TubeParams-connection-${connectionNum}"></select>
              </div>
            </div>
          </div>
        </div>

        <div class="row my-4" id="kt-value-row-connection-${connectionNum}" style="display: none;">
          <div class="col-md-6">
            <div class="row">
              <label for="group" class="col-sm-4 col-form-label">Удельная характеристика K</label>
              <div class="col-sm-8" id="KTValue-connection-${connectionNum}" nowrap>
              </div>
            </div>
          </div>
        </div>
      </form>

      <div id="connection-results-${connectionNum}" style="display: none;">
        <table class="table">
          <thead>
            <th class="text-center">Расход на входе, л/с</th>
            <th class="text-center">Потери давления, м</th>
            <th class="text-center">Давление на выходе, м</th>
          </thead>
          <tbody>
            <tr>
              <td class="text-center" id="connection-Q-in-${connectionNum}"></td>
              <td class="text-center" id="connection-P-loss-${connectionNum}"></td>
              <td class="text-center" id="connection-P-out-${connectionNum}"></td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  }

  // Функция для создания HTML контента новой ветви
  function createBranchHTML(branchNum) {
    return `
      <form id="calc-form-tube-${branchNum}">
        <div class="row">
          <div class="col-md-6">
            <div class="row my-4">
              <label for="group" class="col-sm-4 col-form-label">Тип трубы</label>
              <div class="col-sm-8">
                <select class="form-select" required name="TubeType" id="TubeType-${branchNum}">
                  <option value=""></option>
                </select>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="row my-4">
              <label for="group" class="col-sm-4 col-form-label">Параметры трубы</label>
              <div class="col-sm-8">
                <select class="form-select" required id="TubeParams-${branchNum}"></select>
              </div>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="col-md-6">
            <div class="row my-4">
              <label for="group" class="col-sm-10 col-form-label">Геометрическая высота диктующего оросителя над осью пожарного насоса Н, м</label>
              <div class="col-sm-2">
                <input type="number" class="form-control" required min="2" max="20" step="0.1" value="7.00">
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="row my-4">
              <label for="group" class="col-sm-4 col-form-label">Удельная характеристика K</label>
              <div class="col-sm-8" id="KTValue-${branchNum}" nowrap></div>
            </div>
          </div>
        </div>
      </form>
      <table class="table branchTable" id="branchTable-${branchNum}">
        <thead>
          <th style="width: 150px" class="text-center">Наименование</th>
          <th style="width: 100px" class="text-center">Длина, м</th>
          <th class="text-center">Потери давления, м</th>
          <th class="text-center">Расход, л/с</th>
          <th class="text-center">Давление, м</th>
          <th style="width: 100px" class="text-center">Действия</th>
        </thead>
        <tbody>
          ${[1,2,3,4,5].map(i => `
            <tr data-num="${i}" data-type="sprinkler" class="sprinkler-row">
              <td nowrap>Ороситель ${i}${getBranchLetter(branchNum).toLowerCase()}</td>
              <td class="text-center">-</td>
              <td class="text-center">-</td>
              <td class="Q_sprinkler_value text-center"></td>
              <td class="P_sprinkler_value text-center"></td>
              <td class="text-center">
                <button type="button" class="btn btn-sm delete-sprinkler" data-num="${i}" data-branch="${branchNum}" style="background-color: #0F1379; color: white; border: none;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                  </svg>
                </button>
              </td>
            </tr>
            <tr data-num="${i}" data-type="section" class="section-row">
              <td nowrap>Участок ${i}${getBranchLetter(branchNum).toLowerCase()}-${i+1}${getBranchLetter(branchNum).toLowerCase()}</td>
              <td><input type="number" class="form-control section-length" required min="0" step="0.1"></td>
              <td class="P_loss_value text-center"></td>
              <td class="Q_section_value text-center"></td>
              <td class="P_section_value text-center"></td>
              <td class="Q_total_value text-center" style="display: none;"></td>
              <td></td>
            </tr>
          `).join('')}
          <tr data-type="node" class="node-row" id="node-row-${branchNum}">
            <td nowrap>Узел <span class="node-label">${getBranchLetter(branchNum)}-${getBranchLetter(branchNum + 1)}</span></td>
            <td class="node-length text-center">-</td>
            <td class="node-P-loss text-center">-</td>
            <td class="node-Q text-center">-</td>
            <td class="node-P text-center">-</td>
            <td></td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6">
              <a href="#" class="btn btn-secondary btn-xs add-section" data-branch="${branchNum}">Добавить ороситель</a>
              <a href="#" class="btn btn-danger btn-xs delete-branch ms-2" data-branch="${branchNum}">Удалить ветвь</a>
            </td>
          </tr>
        </tfoot>
      </table>
    `
  }

  // Функция добавления новой ветви
  function addNewBranch() {
    branchCounter++
    const newBranchNum = branchCounter
    const prevBranchNum = newBranchNum - 1
    console.log('Добавляем ветвь:', newBranchNum)

    // Создаем новую вкладку
    const tabList = document.getElementById('myTab')
    const addButton = document.getElementById('add-branch-btn').parentElement

    // Создаем таб соединения между предыдущей и новой ветвью
    const connectionTab = document.createElement('li')
    connectionTab.className = 'nav-item'
    connectionTab.setAttribute('role', 'presentation')
    connectionTab.innerHTML = `
      <button
        class="nav-link connection-tab"
        id="connection-tab-${prevBranchNum}"
        data-bs-toggle="tab"
        data-bs-target="#connection-tab-pane-${prevBranchNum}"
        type="button"
        role="tab"
        aria-controls="connection-tab-pane-${prevBranchNum}"
      >${getBranchLetter(prevBranchNum)}-${getBranchLetter(newBranchNum)}</button>
    `

    // Вставляем перед кнопкой "Добавить ветвь"
    tabList.insertBefore(connectionTab, addButton)

    // Создаем таб новой ветви
    const newTab = document.createElement('li')
    newTab.className = 'nav-item'
    newTab.setAttribute('role', 'presentation')
    newTab.innerHTML = `
      <button
        class="nav-link"
        id="branch-tab-${newBranchNum}"
        data-bs-toggle="tab"
        data-bs-target="#branch-tab-pane-${newBranchNum}"
        type="button"
        role="tab"
        aria-controls="branch-tab-pane-${newBranchNum}"
      >Ветвь ${getBranchLetter(newBranchNum)}</button>
    `

    // Вставляем перед кнопкой "Добавить ветвь"
    tabList.insertBefore(newTab, addButton)

    // Создаем контент для соединения
    const tabContent = document.getElementById('myTabContent')
    const newConnectionPane = document.createElement('div')
    newConnectionPane.className = 'tab-pane fade'
    newConnectionPane.id = `connection-tab-pane-${prevBranchNum}`
    newConnectionPane.setAttribute('role', 'tabpanel')
    newConnectionPane.setAttribute('aria-labelledby', `connection-tab-${prevBranchNum}`)
    newConnectionPane.setAttribute('tabindex', '0')
    newConnectionPane.innerHTML = createConnectionHTML(prevBranchNum)

    tabContent.appendChild(newConnectionPane)

    // Загружаем список труб для соединения
    loadTubeTypes(`connection-${prevBranchNum}`)

    // Инициализируем соединение
    initConnection(prevBranchNum)

    // Создаем контент для новой ветви
    const newTabPane = document.createElement('div')
    newTabPane.className = 'tab-pane fade'
    newTabPane.id = `branch-tab-pane-${newBranchNum}`
    newTabPane.setAttribute('role', 'tabpanel')
    newTabPane.setAttribute('aria-labelledby', `branch-tab-${newBranchNum}`)
    newTabPane.setAttribute('tabindex', '0')
    newTabPane.innerHTML = createBranchHTML(newBranchNum)

    tabContent.appendChild(newTabPane)

    // Загружаем список труб для новой ветви
    loadTubeTypes(newBranchNum)

    // Инициализируем новую ветвь
    initBranch(newBranchNum)

    // Активируем новую вкладку
    const newTabButton = document.getElementById(`branch-tab-${newBranchNum}`)
    const tab = new bootstrap.Tab(newTabButton)
    tab.show()
  }

  // Функция загрузки типов труб (синхронная версия для обратной совместимости)
  function loadTubeTypes(branchNum) {
    loadTubeTypesFromAPI(branchNum)
  }

  // Функция удаления ветви
  function deleteBranch(branchNum) {
    // Не даём удалить, если осталась только одна ветвь
    const tabs = document.querySelectorAll('#myTab .nav-item button[id^="branch-tab-"]')
    if (tabs.length <= 1) {
      alert('Нельзя удалить последнюю ветвь!')
      return
    }

    if (!confirm(`Вы уверены, что хотите удалить Ветвь ${getBranchLetter(branchNum)}?`)) {
      return
    }

    // Удаляем вкладку ветви
    const tab = document.getElementById(`branch-tab-${branchNum}`)
    const tabPane = document.getElementById(`branch-tab-pane-${branchNum}`)

    if (tab && tabPane) {
      // Проверяем, активна ли удаляемая вкладка
      const isActive = tab.classList.contains('active')

      tab.parentElement.remove()
      tabPane.remove()

      // Удаляем соединение перед удаляемой ветвью (если есть)
      const prevConnectionTab = document.getElementById(`connection-tab-${branchNum - 1}`)
      const prevConnectionPane = document.getElementById(`connection-tab-pane-${branchNum - 1}`)
      if (prevConnectionTab && prevConnectionPane) {
        prevConnectionTab.parentElement.remove()
        prevConnectionPane.remove()
      }

      // Удаляем соединение после удаляемой ветви (если это последняя ветвь)
      const nextConnectionTab = document.getElementById(`connection-tab-${branchNum}`)
      const nextConnectionPane = document.getElementById(`connection-tab-pane-${branchNum}`)
      if (nextConnectionTab && nextConnectionPane) {
        nextConnectionTab.parentElement.remove()
        nextConnectionPane.remove()
      }

      // Если удалили активную вкладку, активируем первую
      if (isActive) {
        const firstTab = document.querySelector('#myTab .nav-item button[id^="branch-tab-"]')
        if (firstTab) {
          const tab = new bootstrap.Tab(firstTab)
          tab.show()
        }
      }

      // Перенумеровываем оставшиеся ветви
      renumberBranches()
    }

    // Удаляем данные ветви
    delete kt_values[branchNum]
    delete branchCalculateFunctions[branchNum]
    delete branch_results[branchNum]
    delete connectionCalculateFunctions[branchNum]
  }

  // Функция перенумерации ветвей
  function renumberBranches() {
    // Удаляем все табы соединений
    const connectionTabs = document.querySelectorAll('#myTab .nav-item button[id^="connection-tab-"]')
    const connectionPanes = document.querySelectorAll('#myTabContent .tab-pane[id^="connection-tab-pane-"]')

    connectionTabs.forEach(tab => tab.parentElement.remove())
    connectionPanes.forEach(pane => pane.remove())

    // Перенумеровываем ветви
    const tabs = document.querySelectorAll('#myTab .nav-item button[id^="branch-tab-"]')
    const tabPanes = document.querySelectorAll('#myTabContent .tab-pane[id^="branch-tab-pane-"]')

    tabs.forEach((tab, index) => {
      const newNum = index + 1
      const oldId = tab.id
      const oldNum = oldId.replace('branch-tab-', '')

      // Обновляем текст вкладки
      tab.textContent = `Ветвь ${getBranchLetter(newNum)}`

      // Обновляем ID и атрибуты вкладки
      tab.id = `branch-tab-${newNum}`
      tab.setAttribute('data-bs-target', `#branch-tab-pane-${newNum}`)
      tab.setAttribute('aria-controls', `branch-tab-pane-${newNum}`)

      // Обновляем ID и атрибуты панели контента
      const tabPane = tabPanes[index]
      if (tabPane) {
        tabPane.id = `branch-tab-pane-${newNum}`
        tabPane.setAttribute('aria-labelledby', `branch-tab-${newNum}`)

        // Обновляем ID элементов внутри панели
        updateBranchElementIds(tabPane, oldNum, newNum)
      }
    })

    // Обновляем счётчик ветвей
    branchCounter = tabs.length

    // Создаём соединения заново между ветвями
    const tabList = document.getElementById('myTab')
    const addButton = document.getElementById('add-branch-btn').parentElement
    const tabContent = document.getElementById('myTabContent')

    for (let i = 1; i < tabs.length; i++) {
      const connectionNum = i

      // Создаём таб соединения
      const connectionTab = document.createElement('li')
      connectionTab.className = 'nav-item'
      connectionTab.setAttribute('role', 'presentation')
      connectionTab.innerHTML = `
        <button
          class="nav-link connection-tab"
          id="connection-tab-${connectionNum}"
          data-bs-toggle="tab"
          data-bs-target="#connection-tab-pane-${connectionNum}"
          type="button"
          role="tab"
          aria-controls="connection-tab-pane-${connectionNum}"
        >${getBranchLetter(i)}-${getBranchLetter(i + 1)}</button>
      `

      // Вставляем после i-й ветви (перед i+1-й ветвью или кнопкой "Добавить")
      const nextBranchTab = document.getElementById(`branch-tab-${i + 1}`)
      if (nextBranchTab) {
        tabList.insertBefore(connectionTab, nextBranchTab.parentElement)
      } else {
        tabList.insertBefore(connectionTab, addButton)
      }

      // Создаём панель соединения
      const connectionPane = document.createElement('div')
      connectionPane.className = 'tab-pane fade'
      connectionPane.id = `connection-tab-pane-${connectionNum}`
      connectionPane.setAttribute('role', 'tabpanel')
      connectionPane.setAttribute('aria-labelledby', `connection-tab-${connectionNum}`)
      connectionPane.setAttribute('tabindex', '0')
      connectionPane.innerHTML = createConnectionHTML(connectionNum)

      tabContent.appendChild(connectionPane)

      // Загружаем список труб для соединения
      loadTubeTypes(`connection-${connectionNum}`)

      // Инициализируем соединение
      initConnection(connectionNum)
    }
  }

  // Функция обновления ID элементов внутри ветви
  function updateBranchElementIds(tabPane, oldNum, newNum) {
    // Обновляем ID формы
    const form = tabPane.querySelector(`#calc-form-tube-${oldNum}`)
    if (form) form.id = `calc-form-tube-${newNum}`

    // Обновляем ID селектов и других элементов
    const tubeType = tabPane.querySelector(`#TubeType-${oldNum}`)
    if (tubeType) tubeType.id = `TubeType-${newNum}`

    const tubeParams = tabPane.querySelector(`#TubeParams-${oldNum}`)
    if (tubeParams) tubeParams.id = `TubeParams-${newNum}`

    const ktValue = tabPane.querySelector(`#KTValue-${oldNum}`)
    if (ktValue) ktValue.id = `KTValue-${newNum}`

    const branchTable = tabPane.querySelector(`#branchTable-${oldNum}`)
    if (branchTable) branchTable.id = `branchTable-${newNum}`

    // Обновляем data-branch на кнопках
    const addSection = tabPane.querySelector(`.add-section[data-branch="${oldNum}"]`)
    if (addSection) addSection.setAttribute('data-branch', newNum)

    const deleteBranchBtn = tabPane.querySelector(`.delete-branch[data-branch="${oldNum}"]`)
    if (deleteBranchBtn) deleteBranchBtn.setAttribute('data-branch', newNum)

    // Переносим данные kt_values
    if (kt_values[oldNum]) {
      kt_values[newNum] = kt_values[oldNum]
      delete kt_values[oldNum]
    }

    // Переносим данные branchCalculateFunctions
    if (branchCalculateFunctions[oldNum]) {
      delete branchCalculateFunctions[oldNum]
    }

    // Переносим данные connectionCalculateFunctions
    if (connectionCalculateFunctions[oldNum]) {
      delete connectionCalculateFunctions[oldNum]
    }

    // Переносим данные branch_results
    if (branch_results[oldNum]) {
      branch_results[newNum] = branch_results[oldNum]
      delete branch_results[oldNum]
    }

    // Переинициализируем ветвь с новым номером
    initBranch(newNum)
  }

  function initConnection(connectionNum) {
    const
      connectionLength = document.getElementById(`connection-length-${connectionNum}`),
      tubeParamsBlock = document.getElementById(`tube-params-block-connection-${connectionNum}`),
      TubeType = document.getElementById(`TubeType-connection-${connectionNum}`),
      TubeParams = document.getElementById(`TubeParams-connection-${connectionNum}`),
      KTValue = document.getElementById(`KTValue-connection-${connectionNum}`)

    if (!connectionLength || !tubeParamsBlock) return
    if (!TubeType || !TubeParams || !KTValue) return

    // Обработчик изменения длины соединения
    connectionLength.addEventListener("input", function() {
      const ktValueRow = document.getElementById(`kt-value-row-connection-${connectionNum}`)
      if (parseFloat(this.value) > 0) {
        tubeParamsBlock.style.display = ""
      } else {
        tubeParamsBlock.style.display = "none"
        // Сбрасываем значения
        TubeType.value = ""
        TubeParams.innerHTML = ""
        KTValue.innerHTML = ""
        connection_kt_values[connectionNum] = ""
        // Скрываем блоки
        if (ktValueRow) ktValueRow.style.display = "none"
        const resultsDiv = document.getElementById(`connection-results-${connectionNum}`)
        if (resultsDiv) resultsDiv.style.display = "none"
      }
      calculateConnection(connectionNum)
    })

    TubeType.addEventListener("change", function() {
      const TubeTypeValue = this.value
      if(TubeTypeValue){
        KTValue.innerHTML = ""
        fetch(`/api/tubes/list/?type_id=${TubeTypeValue}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            TubeParams.innerHTML = '<option value="">выберите параметры</option>';
            data.forEach(el => {
              TubeParams.innerHTML += `<option value="${el.k_t}">DN ${el.nom_size} / Наружный диаметр ${el.ext_size}, мм / Толщина стенки ${el.thickness}, мм</option>`
            })
          })
          .catch(error => {
            console.error('Fetch error:', error);
          });
      }
    })

    TubeParams.addEventListener("change", function() {
      const ktValueRow = document.getElementById(`kt-value-row-connection-${connectionNum}`)
      if(this.value){
        connection_kt_values[connectionNum] = this.value
        KTValue.innerHTML = `${this.value}, л²/с²`
        if (ktValueRow) ktValueRow.style.display = ""
        calculateConnection(connectionNum)
      } else {
        KTValue.innerHTML = ""
        connection_kt_values[connectionNum] = ""
        if (ktValueRow) ktValueRow.style.display = "none"
      }
    })

    // Функция расчёта соединения
    function calculateConnection(connectionNum) {
      const length = parseFloat(connectionLength.value) || 0
      const resultsDiv = document.getElementById(`connection-results-${connectionNum}`)

      // Получаем результаты предыдущей ветви (левой)
      const prevBranchNum = connectionNum
      const prevBranchResults = branch_results[prevBranchNum]

      // Получаем результаты следующей ветви (правой)
      const nextBranchNum = connectionNum + 1
      const nextBranchResults = branch_results[nextBranchNum]

      const nodeRow = document.getElementById(`node-row-${connectionNum}`)

      // Если нет результатов предыдущей ветви, показываем прочерки
      if (!prevBranchResults) {
        if (resultsDiv) resultsDiv.style.display = "none"
        if (nodeRow) {
          const nodeLength = nodeRow.querySelector('.node-length')
          const nodePLoss = nodeRow.querySelector('.node-P-loss')
          const nodeQ = nodeRow.querySelector('.node-Q')
          const nodeP = nodeRow.querySelector('.node-P')

          if (nodeLength) nodeLength.innerHTML = '-'
          if (nodePLoss) nodePLoss.innerHTML = '-'
          if (nodeQ) nodeQ.innerHTML = '-'
          if (nodeP) nodeP.innerHTML = '-'
        }
        return
      }

      let Q_in = prevBranchResults.Q_total
      let P_in = prevBranchResults.P_total

      // Если есть результаты следующей ветви, применяем пересчет по максимальному давлению
      if (nextBranchResults) {
        const P_next = nextBranchResults.P_total
        const Q_next = nextBranchResults.Q_total

        // Находим максимальное давление
        const P_max = Math.max(P_in, P_next)

        // Пересчитываем расходы для ветвей с меньшим давлением
        // Q_итоговый = Q_начальный × √(P_максимальный / P_начальный)
        let Q_prev_adjusted = Q_in
        let Q_next_adjusted = Q_next

        if (P_in < P_max) {
          Q_prev_adjusted = Q_in * Math.sqrt(P_max / P_in)
        }

        if (P_next < P_max) {
          Q_next_adjusted = Q_next * Math.sqrt(P_max / P_next)
        }

        // Суммируем расходы
        Q_in = Q_prev_adjusted + Q_next_adjusted
        P_in = P_max
      }

      // Если длина = 0 или не заданы параметры, показываем только расход и давление без потерь
      if (length === 0 || !connection_kt_values[connectionNum]) {
        if (resultsDiv) resultsDiv.style.display = "none"

        if (nodeRow) {
          const nodeLength = nodeRow.querySelector('.node-length')
          const nodePLoss = nodeRow.querySelector('.node-P-loss')
          const nodeQ = nodeRow.querySelector('.node-Q')
          const nodeP = nodeRow.querySelector('.node-P')

          if (nodeLength) nodeLength.innerHTML = length > 0 ? length.toFixed(1) : '-'
          if (nodePLoss) nodePLoss.innerHTML = '-'
          if (nodeQ) nodeQ.innerHTML = `${Q_in.toFixed(2)}`
          if (nodeP) nodeP.innerHTML = `${P_in.toFixed(2)}`
        }
        return
      }

      // Расчёт потерь давления: ΔP = (Q² × L) / kt
      const P_loss = (Q_in * Q_in * length) / connection_kt_values[connectionNum]
      const P_out = P_in + P_loss

      // Отображаем результаты в блоке соединения
      document.getElementById(`connection-Q-in-${connectionNum}`).innerHTML = `${Q_in.toFixed(2)}`
      document.getElementById(`connection-P-loss-${connectionNum}`).innerHTML = `${P_loss.toFixed(2)}`
      document.getElementById(`connection-P-out-${connectionNum}`).innerHTML = `${P_out.toFixed(2)}`

      if (resultsDiv) resultsDiv.style.display = "block"

      // Отображаем результаты в строке узла таблицы предыдущей ветви
      if (nodeRow) {
        const nodeLength = nodeRow.querySelector('.node-length')
        const nodePLoss = nodeRow.querySelector('.node-P-loss')
        const nodeQ = nodeRow.querySelector('.node-Q')
        const nodeP = nodeRow.querySelector('.node-P')

        if (nodeLength) nodeLength.innerHTML = `${length.toFixed(1)}`
        if (nodePLoss) nodePLoss.innerHTML = `${P_loss.toFixed(2)}`
        if (nodeQ) nodeQ.innerHTML = `${Q_in.toFixed(2)}`
        if (nodeP) nodeP.innerHTML = `${P_out.toFixed(2)}`
      }

      // Сохраняем результаты для следующей ветви
      branch_results[`connection-${connectionNum}`] = {
        Q_total: Q_in,
        P_total: P_out
      }

      // Пересчитываем питающий трубопровод
      if (typeof calculateFeedPipe === 'function') {
        calculateFeedPipe()
      }
    }

    // Сохраняем функцию расчета соединения для доступа извне
    connectionCalculateFunctions[connectionNum] = () => calculateConnection(connectionNum)
  }

  // Функция удаления оросителя
  function deleteSprinkler(branchNum, sprinklerNum) {
    const branchTable = document.getElementById(`branchTable-${branchNum}`)
    if (!branchTable) return

    const tbody = branchTable.querySelector('tbody')
    const sprinklerRows = tbody.querySelectorAll('tr[data-type="sprinkler"]')

    // Не даём удалить, если остался только один ороситель
    if (sprinklerRows.length <= 1) {
      alert('Нельзя удалить последний ороситель!')
      return
    }

    if (!confirm(`Вы уверены, что хотите удалить ороситель ${sprinklerNum}${getBranchLetter(branchNum).toLowerCase()}?`)) {
      return
    }

    // Находим строку оросителя и следующую за ней строку участка
    const sprinklerRow = tbody.querySelector(`tr[data-type="sprinkler"][data-num="${sprinklerNum}"]`)
    const sectionRow = tbody.querySelector(`tr[data-type="section"][data-num="${sprinklerNum}"]`)

    if (sprinklerRow) sprinklerRow.remove()
    if (sectionRow) sectionRow.remove()

    // Перенумеровываем оставшиеся оросители
    renumberSprinklers(branchNum)

    // Пересчитываем ветвь, если функция расчета доступна
    if (branchCalculateFunctions[branchNum]) {
      branchCalculateFunctions[branchNum]()
    }
  }

  // Функция перенумерации оросителей в ветви
  function renumberSprinklers(branchNum) {
    const branchTable = document.getElementById(`branchTable-${branchNum}`)
    if (!branchTable) return

    const tbody = branchTable.querySelector('tbody')
    const allRows = tbody.querySelectorAll('tr[data-type="sprinkler"], tr[data-type="section"]')

    let currentNum = 1
    for (let i = 0; i < allRows.length; i += 2) {
      const sprinklerRow = allRows[i]
      const sectionRow = allRows[i + 1]

      if (sprinklerRow && sprinklerRow.getAttribute('data-type') === 'sprinkler') {
        sprinklerRow.setAttribute('data-num', currentNum)
        const sprinklerName = sprinklerRow.querySelector('td:first-child')
        if (sprinklerName) {
          sprinklerName.textContent = `Ороситель ${currentNum}${getBranchLetter(branchNum).toLowerCase()}`
        }
        const deleteBtn = sprinklerRow.querySelector('.delete-sprinkler')
        if (deleteBtn) {
          deleteBtn.setAttribute('data-num', currentNum)
        }
      }

      if (sectionRow && sectionRow.getAttribute('data-type') === 'section') {
        sectionRow.setAttribute('data-num', currentNum)
        const sectionName = sectionRow.querySelector('td:first-child')
        if (sectionName) {
          sectionName.textContent = `Участок ${currentNum}${getBranchLetter(branchNum).toLowerCase()}-${currentNum + 1}${getBranchLetter(branchNum).toLowerCase()}`
        }
      }

      currentNum++
    }
  }

  function initBranch(branchNum) {
    const
      TubeType = document.getElementById(`TubeType-${branchNum}`),
      TubeParams = document.getElementById(`TubeParams-${branchNum}`),
      KTValue = document.getElementById(`KTValue-${branchNum}`)

    if (!TubeType || !TubeParams || !KTValue) return

    kt_values[branchNum] = ""

    TubeType.addEventListener("change", function() {
      const TubeTypeValue = this.value
      if(TubeTypeValue){
        KTValue.innerHTML = ""
        fetch(`/api/tubes/list/?type_id=${TubeTypeValue}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            TubeParams.innerHTML = '<option value="">выберите параметры</option>';
            data.forEach(el => {
              TubeParams.innerHTML += `<option value="${el.k_t}">DN ${el.nom_size} / Наружный диаметр ${el.ext_size}, мм / Толщина стенки ${el.thickness}, мм</option>`
            })
          })
          .catch(error => {
            console.error('Fetch error:', error);
          });
      }
    })

    TubeParams.addEventListener("change", function() {
      if(this.value){
        kt_values[branchNum] = this.value
        KTValue.innerHTML = `${this.value}, л²/с²`
        branchCalculate(branchNum)
      } else {
        KTValue.innerHTML = ""
      }
    })

    // Функция расчёта требуемых параметров насоса
    function calculatePumpRequirements() {
      // Проверяем, что есть хотя бы одна ветвь с результатами
      if (Object.keys(branch_results).length === 0) {
        return
      }

      // Находим максимальные значения P и Q среди всех ветвей
      let maxP = 0
      let maxQ = 0
      let totalPipeLosses = 0

      for (const branchNum in branch_results) {
        const result = branch_results[branchNum]
        if (result.P_total > maxP) {
          maxP = result.P_total
        }
        if (result.Q_total > maxQ) {
          maxQ = result.Q_total
        }
      }

      // Вычисляем суммарные потери в трубопроводах
      // (разница между максимальным давлением и начальным давлением у диктующего оросителя)
      totalPipeLosses = maxP - pwork_meter_value

      // Геометрическая высота в МПа (H в метрах / 100)
      const heightInput = document.getElementById('sklad_height') || document.getElementById('height-input')
      const H = parseFloat(heightInput?.value) || 0
      const Z = H / 100 // МПа

      // Местные сопротивления (20% от линейных потерь)
      const localLosses = totalPipeLosses * 0.20

      // Давление у диктующего оросителя в МПа
      const Pd = pwork_meter_value / 100 // конвертируем из метров в МПа

      // Потери в трубопроводах в МПа
      const pipeLossesMPa = totalPipeLosses / 100

      // Местные сопротивления в МПа
      const localLossesMPa = localLosses / 100

      // Требуемый напор насоса: Pн = Pд + Z + ΣΔP + Pм - Pвх
      const requiredPressure = Pd + Z + pipeLossesMPa + localLossesMPa - inlet_pressure_value

      // Требуемый напор в метрах
      const requiredPressureMeters = requiredPressure * 100

      // Требуемый расход в м³/ч (конвертируем из л/с)
      const requiredFlow = (maxQ * 3.6).toFixed(2) // л/с * 3.6 = м³/ч

      // Отображаем результаты
      document.getElementById('required-pressure').innerHTML = `${requiredPressureMeters.toFixed(2)} м`
      document.getElementById('required-flow').innerHTML = `${requiredFlow} м³/ч`

      // Заполняем расшифровку
      document.getElementById('calc-detail-pd').innerHTML = `${(Pd * 100).toFixed(2)} м (${Pd.toFixed(4)} МПа)`
      document.getElementById('calc-detail-z').innerHTML = `${(Z * 100).toFixed(2)} м (${Z.toFixed(4)} МПа)`
      document.getElementById('calc-detail-pipe-losses').innerHTML = `${totalPipeLosses.toFixed(2)} м (${pipeLossesMPa.toFixed(4)} МПа)`
      document.getElementById('calc-detail-local-losses').innerHTML = `${localLosses.toFixed(2)} м (${localLossesMPa.toFixed(4)} МПa)`
      document.getElementById('calc-detail-inlet').innerHTML = `${(inlet_pressure_value * 100).toFixed(2)} м (${inlet_pressure_value.toFixed(4)} МПа)`
      document.getElementById('calc-detail-total').innerHTML = `${requiredPressureMeters.toFixed(2)} м (${requiredPressure.toFixed(4)} МПа)`

      // Показываем блок с результатами
      document.getElementById('pump-results-block').style.display = 'block'
    }

    // расчёт параметров ветви //
    function branchCalculate(branchNum){
      const
        branchTable = document.getElementById(`branchTable-${branchNum}`),
        allRows = branchTable.querySelectorAll('tbody > tr')

      // Проверяем, что kt_values установлен для этой ветви
      if (!kt_values[branchNum] || kt_values[branchNum] === "") {
        console.log(`kt_values not set for branch ${branchNum}`)
        return
      }

      // Проверяем, что branchTable существует
      if (!branchTable) {
        console.log(`branchTable not found for branch ${branchNum}`)
        return
      }

      // Собираем пары строк (ороситель + участок)
      const pairs = []
      for (let i = 0; i < allRows.length; i += 2) {
        const sprinklerRow = allRows[i]
        const sectionRow = allRows[i + 1]

        if (sprinklerRow && sectionRow) {
          const input = sectionRow.querySelector('input.section-length')
          if (input && input.value) {
            pairs.push({ sprinklerRow, sectionRow, length: parseFloat(input.value) })
          }
        }
      }

      // Если нет данных, выходим
      if (pairs.length === 0) return

      // Расчёт от диктующего оросителя (первого) к началу ветви (против потока воды)
      let P = pwork_meter_value
      let Q = 0

      // Проходим по парам в прямом порядке (от диктующего оросителя)
      for (let i = 0; i < pairs.length; i++) {
        const { sprinklerRow, sectionRow, length } = pairs[i]

        // Расход через ороситель: Q = K × √P
        const Q_sprinkler = sprinkler_K_value * Math.sqrt(P) // результат в л/с

        // Выводим данные оросителя
        const Q_sprinkler_el = sprinklerRow.querySelector('td.Q_sprinkler_value')
        const P_sprinkler_el = sprinklerRow.querySelector('td.P_sprinkler_value')

        if (Q_sprinkler_el) Q_sprinkler_el.innerHTML = `${Q_sprinkler.toFixed(2)}`
        if (P_sprinkler_el) P_sprinkler_el.innerHTML = `${P.toFixed(2)}`

        // Суммарный расход увеличивается
        Q += Q_sprinkler

        // Потери давления на участке: ΔP = (Q² × L) / Kt
        const P_loss = (Q * Q * length) / kt_values[branchNum]

        // Давление увеличивается (идём против потока)
        P += P_loss

        // Выводим данные участка
        const P_loss_el = sectionRow.querySelector('td.P_loss_value')
        const Q_section_el = sectionRow.querySelector('td.Q_section_value')
        const P_section_el = sectionRow.querySelector('td.P_section_value')
        const Q_total_el = sectionRow.querySelector('td.Q_total_value')

        if (P_loss_el) P_loss_el.innerHTML = `${P_loss.toFixed(3)}`
        if (Q_section_el) Q_section_el.innerHTML = `${Q.toFixed(2)}`
        if (P_section_el) P_section_el.innerHTML = `${P.toFixed(2)}`
        if (Q_total_el) Q_total_el.innerHTML = `${Q.toFixed(3)}`
      }

      // Сохраняем результаты ветви для использования в соединении
      branch_results[branchNum] = {
        Q_total: Q,
        P_total: P
      }

      // Обновляем строку узла в таблице (если есть соединение)
      // Проверяем, существует ли функция calculateConnection для этой ветви
      const connectionNum = branchNum
      const nodeRow = document.getElementById(`node-row-${connectionNum}`)
      if (nodeRow) {
        const nodePLoss = nodeRow.querySelector('.node-P-loss')
        const nodeQ = nodeRow.querySelector('.node-Q')
        const nodeP = nodeRow.querySelector('.node-P')

        // Если соединение еще не настроено, показываем только базовые данные
        if (nodePLoss) nodePLoss.innerHTML = '-'
        if (nodeQ) nodeQ.innerHTML = `${Q.toFixed(2)}`
        if (nodeP) nodeP.innerHTML = `${P.toFixed(2)}`
      }

      // Пересчитываем соединение для этой ветви (если оно существует)
      triggerConnectionRecalculation(branchNum)

      // Пересчитываем требуемые параметры насоса
      calculatePumpRequirements()
    }

    // Сохраняем функцию расчета для доступа извне
    branchCalculateFunctions[branchNum] = () => branchCalculate(branchNum)

    // навешиваем обработчики на существующие инпуты //
    const branch_inputs = document.querySelectorAll(`#branchTable-${branchNum} tbody input.section-length`)
    branch_inputs.forEach((elem) => elem.addEventListener("change", () => {
      branchCalculate(branchNum)
    }))

    // навешиваем обработчики на кнопки удаления оросителей //
    const delete_sprinkler_btns = document.querySelectorAll(`#branchTable-${branchNum} tbody .delete-sprinkler`)
    delete_sprinkler_btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const sprinklerNum = parseInt(btn.getAttribute('data-num'))
        deleteSprinkler(branchNum, sprinklerNum)
      })
    })

    // добавление новых участков //
    const add_section_btn = document.querySelector(`.add-section[data-branch="${branchNum}"]`)
    if (add_section_btn) {
      // Удаляем все старые обработчики путем клонирования элемента
      const new_add_section_btn = add_section_btn.cloneNode(true)
      add_section_btn.parentNode.replaceChild(new_add_section_btn, add_section_btn)

      new_add_section_btn.addEventListener("click", (e) => {
        e.preventDefault()
        const
          branchTable = document.getElementById(`branchTable-${branchNum}`),
          tbody = branchTable.querySelector('tbody'),
          nodeRow = document.getElementById(`node-row-${branchNum}`),
          rows = tbody.querySelectorAll('tr[data-type="sprinkler"], tr[data-type="section"]'),
          new_num = (rows.length / 2) + 1 // Делим на 2, т.к. у нас пара строк на каждый ороситель

        // Создаем строку оросителя
        const sprinkler_row = document.createElement('tr')
        sprinkler_row.setAttribute("data-num", new_num)
        sprinkler_row.setAttribute("data-type", "sprinkler")
        sprinkler_row.className = "sprinkler-row"
        sprinkler_row.innerHTML = `
          <td nowrap>Ороситель ${new_num}${getBranchLetter(branchNum).toLowerCase()}</td>
          <td class="text-center">-</td>
          <td class="text-center">-</td>
          <td class="Q_sprinkler_value text-center"></td>
          <td class="P_sprinkler_value text-center"></td>
          <td class="text-center">
            <button type="button" class="btn btn-sm delete-sprinkler" data-num="${new_num}" data-branch="${branchNum}" style="background-color: #0F1379; color: white; border: none;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
              </svg>
            </button>
          </td>
        `
        // Вставляем ПЕРЕД строкой узла
        tbody.insertBefore(sprinkler_row, nodeRow)

        // Создаем строку участка
        const section_row = document.createElement('tr')
        section_row.setAttribute("data-num", new_num)
        section_row.setAttribute("data-type", "section")
        section_row.className = "section-row"
        section_row.innerHTML = `
          <td nowrap>Участок ${new_num}${getBranchLetter(branchNum).toLowerCase()}-${new_num+1}${getBranchLetter(branchNum).toLowerCase()}</td>
          <td><input type="number" class="form-control section-length" required min="0" step="0.1"></td>
          <td class="P_loss_value text-center"></td>
          <td class="Q_section_value text-center"></td>
          <td class="P_section_value text-center"></td>
          <td class="Q_total_value text-center" style="display: none;"></td>
          <td></td>
        `
        // Вставляем ПЕРЕД строкой узла
        tbody.insertBefore(section_row, nodeRow)

        const new_input = section_row.querySelector('input.section-length')
        new_input.addEventListener("change", () => {
          branchCalculate(branchNum)
        })

        // Добавляем обработчик для кнопки удаления
        const delete_btn = sprinkler_row.querySelector('.delete-sprinkler')
        delete_btn.addEventListener("click", () => {
          deleteSprinkler(branchNum, new_num)
        })
      })
    }

    // удаление ветви //
    const delete_branch_btn = document.querySelector(`.delete-branch[data-branch="${branchNum}"]`)
    if (delete_branch_btn) {
      // Удаляем все старые обработчики путем клонирования элемента
      const new_delete_btn = delete_branch_btn.cloneNode(true)
      delete_branch_btn.parentNode.replaceChild(new_delete_btn, delete_branch_btn)

      new_delete_btn.addEventListener("click", (e) => {
        e.preventDefault()
        deleteBranch(branchNum)
      })
    }
  }

  // Функция создания начальных ветвей
  async function initializeInitialBranches() {
    const tabList = document.getElementById('myTab')
    const tabContent = document.getElementById('myTabContent')
    const addButton = document.getElementById('add-branch-btn').parentElement

    // Создаем 3 начальные ветви
    for (let i = 1; i <= 3; i++) {
      // Создаем таб ветви
      const branchTab = document.createElement('li')
      branchTab.className = 'nav-item'
      branchTab.setAttribute('role', 'presentation')
      branchTab.innerHTML = `
        <button
          class="nav-link${i === 1 ? ' active' : ''}"
          id="branch-tab-${i}"
          data-bs-toggle="tab"
          data-bs-target="#branch-tab-pane-${i}"
          type="button"
          role="tab"
          aria-controls="branch-tab-pane-${i}"
        >Ветвь ${getBranchLetter(i)}</button>
      `
      tabList.insertBefore(branchTab, addButton)

      // Создаем контент ветви
      const branchPane = document.createElement('div')
      branchPane.className = `tab-pane fade${i === 1 ? ' show active' : ''}`
      branchPane.id = `branch-tab-pane-${i}`
      branchPane.setAttribute('role', 'tabpanel')
      branchPane.setAttribute('aria-labelledby', `branch-tab-${i}`)
      branchPane.setAttribute('tabindex', '0')
      branchPane.innerHTML = createBranchHTML(i)
      tabContent.appendChild(branchPane)

      // Загружаем типы труб
      await loadTubeTypesFromAPI(i)

      // Инициализируем ветвь
      initBranch(i)

      // Создаем соединение (кроме последней ветви)
      if (i < 3) {
        // Создаем таб соединения
        const connectionTab = document.createElement('li')
        connectionTab.className = 'nav-item'
        connectionTab.setAttribute('role', 'presentation')
        connectionTab.innerHTML = `
          <button
            class="nav-link connection-tab"
            id="connection-tab-${i}"
            data-bs-toggle="tab"
            data-bs-target="#connection-tab-pane-${i}"
            type="button"
            role="tab"
            aria-controls="connection-tab-pane-${i}"
          >${getBranchLetter(i)}-${getBranchLetter(i + 1)}</button>
        `
        tabList.insertBefore(connectionTab, addButton)

        // Создаем контент соединения
        const connectionPane = document.createElement('div')
        connectionPane.className = 'tab-pane fade'
        connectionPane.id = `connection-tab-pane-${i}`
        connectionPane.setAttribute('role', 'tabpanel')
        connectionPane.setAttribute('aria-labelledby', `connection-tab-${i}`)
        connectionPane.setAttribute('tabindex', '0')
        connectionPane.innerHTML = createConnectionHTML(i)
        tabContent.appendChild(connectionPane)

        // Загружаем типы труб для соединения
        await loadTubeTypesFromAPI(`connection-${i}`)

        // Инициализируем соединение
        initConnection(i)
      }
    }
  }

  // Функция загрузки типов труб через API
  async function loadTubeTypesFromAPI(branchNum) {
    const tubeTypeSelect = document.getElementById(`TubeType-${branchNum}`)
    if (!tubeTypeSelect) return

    try {
      const response = await fetch('/api/tubes/types/')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      tubeTypeSelect.innerHTML = '<option value=""></option>'
      data.forEach(tubeType => {
        tubeTypeSelect.innerHTML += `<option value="${tubeType.id}">${tubeType.name}</option>`
      })
    } catch (error) {
      console.error('Fetch error:', error)
    }
  }

  // Инициализируем начальные ветви при загрузке страницы
  initializeInitialBranches()

  // Обработчик кнопки "Добавить ветвь"
  const addBranchBtn = document.getElementById('add-branch-btn')
  if (addBranchBtn) {
    addBranchBtn.addEventListener('click', addNewBranch)
  }


  // слайдеры высоты//
  let
    heightSlider = document.getElementById('height-slider'),
    heightEl = document.querySelector("#height-input");

  noUiSlider.create(
    heightSlider, {
      range: {'min': 2, 'max': 20},
      connect: 'lower',
      step: 0.1,
      start: [7],
    }
  );
  heightSlider.noUiSlider.on('update', (values) => heightEl.value=values[0])
  heightSlider.noUiSlider.on('change', () => calculate(is_form_submited))
  heightEl.addEventListener("change", (e) => heightSlider.noUiSlider.set(e.target.value))


  // слайдеры высоты склада//
  let
  skladHeightSlider = document.getElementById('sklad_height_slider');

  noUiSlider.create(
    skladHeightSlider, {
      range: {'min': 0, 'max': 5},
      connect: 'lower',
      step: 0.1,
      start: [0],
    }
  );
  skladHeightSlider.noUiSlider.on('update', (values) => skladHeightEl.value=values[0])
  skladHeightSlider.noUiSlider.on('change', () => calculate(is_form_submited))
  skladHeightEl.addEventListener("change", (e) => skladHeightSlider.noUiSlider.set(e.target.value))

  // слайдеры гидравлического давления //
  let
    p_gidrSlider = document.getElementById('p_gidr_slider'),
    p_gidrEl = document.querySelector("#p_gidr_input");

  noUiSlider.create(
    p_gidrSlider, {
      range: {'min': 0.14, 'max': 1.6},
      connect: 'lower',
      step: 0.01,
      start: [0.90],
    }
  );
  p_gidrSlider.noUiSlider.on('update', (values) => p_gidrEl.value=values[0])
  p_gidrSlider.noUiSlider.on('change', () => calculate(is_form_submited))
  p_gidrEl.addEventListener("change", (e) => p_gidrSlider.noUiSlider.set(e.target.value))

  // Обработчик кликов по строкам таблицы узлов управления
  const controlUnitTable = document.getElementById('sprinklers-list')
  if (controlUnitTable) {
    const rows = controlUnitTable.querySelectorAll('tbody tr')
    rows.forEach(row => {
      row.style.cursor = 'pointer'
      row.addEventListener('click', function(e) {
        // Если клик был по самому радиобаттону, не обрабатываем
        if (e.target.tagName === 'INPUT' && e.target.type === 'radio') {
          return
        }

        // Находим радиобаттон в этой строке и кликаем по нему
        const radio = this.querySelector('input[type="radio"]')
        if (radio) {
          radio.checked = true
        }
      })
    })
  }

  // Глобальные переменные для хранения текущих фильтров
  let currentInstallationType = ''
  let currentMinDiameter = 0

  // Общая функция фильтрации узлов управления
  function applyControlUnitFilters() {
    const controlUnitTable = document.getElementById('sprinklers-list')
    if (!controlUnitTable) return

    const rows = controlUnitTable.querySelectorAll('tbody tr')

    rows.forEach(row => {
      const rowInstallationType = row.getAttribute('data-installation-type')
      const diameterCell = row.querySelector('td:nth-child(3)')
      const diameter = diameterCell ? parseInt(diameterCell.textContent.trim()) : 0

      let shouldShow = true

      // Проверяем фильтр по типу установки
      if (currentInstallationType && rowInstallationType !== currentInstallationType) {
        shouldShow = false
      }

      // Проверяем фильтр по диаметру
      if (currentMinDiameter > 0 && diameter < currentMinDiameter) {
        shouldShow = false
      }

      // Применяем видимость
      if (shouldShow) {
        row.style.display = ''
      } else {
        row.style.display = 'none'
        // Снимаем выбор с радиокнопки, если она была выбрана
        const radio = row.querySelector('input[type="radio"]')
        if (radio && radio.checked) {
          radio.checked = false
        }
      }
    })
  }

  // Функция фильтрации узлов управления по типу установки
  function filterControlUnitsByInstallationType(installationType) {
    currentInstallationType = installationType
    applyControlUnitFilters()
  }

  // Обработчик изменения типа установки пожаротушения
  const installationTypeSelect = document.getElementById('installation-type')
  if (installationTypeSelect) {
    installationTypeSelect.addEventListener('change', function() {
      filterControlUnitsByInstallationType(this.value)
    })

    // Применяем фильтр при загрузке страницы с дефолтным значением
    filterControlUnitsByInstallationType(installationTypeSelect.value)
  }

  // Инициализация питающего трубопровода
  let feedPipeKt = null

  // Функция расчета питающего трубопровода (объявляем заранее)
  window.calculateFeedPipe = function() {
    const feedPipeLength = document.getElementById('feed-pipe-length')
    const length = parseFloat(feedPipeLength?.value) || 0

    // Получаем максимальные значения Q и P из всех ветвей и соединений
    let maxQ = 0
    let maxP = 0

    // Проверяем результаты всех ветвей и соединений
    for (const key in branch_results) {
      // Пропускаем feed-pipe чтобы избежать циклической зависимости
      if (key === 'feed-pipe') continue

      const result = branch_results[key]
      if (result && result.Q_total !== undefined && result.P_total !== undefined) {
        if (result.Q_total > maxQ) {
          maxQ = result.Q_total
        }
        if (result.P_total > maxP) {
          maxP = result.P_total
        }
      }
    }

    // Если нет данных, показываем прочерки
    if (maxQ === 0 && maxP === 0) {
      const qEl = document.getElementById('feed-pipe-Q-in')
      const pLossEl = document.getElementById('feed-pipe-P-loss')
      const pOutEl = document.getElementById('feed-pipe-P-out')

      if (qEl) qEl.innerHTML = '-'
      if (pLossEl) pLossEl.innerHTML = '-'
      if (pOutEl) pOutEl.innerHTML = '-'
      return
    }

    const Q_in = maxQ
    const P_in = maxP

    // Если длина = 0 или не заданы параметры трубы
    if (length === 0 || !feedPipeKt) {
      document.getElementById('feed-pipe-Q-in').innerHTML = `${Q_in.toFixed(2)}`
      document.getElementById('feed-pipe-P-loss').innerHTML = '-'
      document.getElementById('feed-pipe-P-out').innerHTML = `${P_in.toFixed(2)}`

      // Сохраняем результаты без изменения давления
      branch_results['feed-pipe'] = {
        Q_total: Q_in,
        P_total: P_in
      }
      return
    }

    // Расчет потерь давления: ΔP = (Q² × L) / kt
    const P_loss = (Q_in * Q_in * length) / feedPipeKt
    const P_out = P_in + P_loss

    // Отображаем результаты
    document.getElementById('feed-pipe-Q-in').innerHTML = `${Q_in.toFixed(2)}`
    document.getElementById('feed-pipe-P-loss').innerHTML = `${P_loss.toFixed(2)}`
    document.getElementById('feed-pipe-P-out').innerHTML = `${P_out.toFixed(2)}`

    // Сохраняем результаты
    branch_results['feed-pipe'] = {
      Q_total: Q_in,
      P_total: P_out
    }
  }

  const feedPipeLength = document.getElementById('feed-pipe-length')
  const feedPipeType = document.getElementById('feed-pipe-type')
  const feedPipeParams = document.getElementById('feed-pipe-params')
  const feedPipeKtValue = document.getElementById('feed-pipe-kt')

  // Загружаем типы труб для питающего трубопровода
  async function loadFeedPipeTubeTypes() {
    try {
      const response = await fetch('/api/tubes/types/')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      feedPipeType.innerHTML = '<option value=""></option>'
      data.forEach(tubeType => {
        feedPipeType.innerHTML += `<option value="${tubeType.id}">${tubeType.name}</option>`
      })
    } catch (error) {
      console.error('Fetch error:', error)
    }
  }

  loadFeedPipeTubeTypes()

  // Обработчик изменения типа трубы
  feedPipeType.addEventListener('change', function() {
    const tubeTypeValue = this.value
    if (tubeTypeValue) {
      feedPipeKtValue.innerHTML = ''
      fetch(`/api/tubes/list/?type_id=${tubeTypeValue}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          return response.json()
        })
        .then(data => {
          feedPipeParams.innerHTML = '<option value="">выберите параметры</option>'
          data.forEach(el => {
            feedPipeParams.innerHTML += `<option value="${el.k_t}">DN ${el.nom_size} / Наружный диаметр ${el.ext_size}, мм / Толщина стенки ${el.thickness}, мм</option>`
          })
        })
        .catch(error => {
          console.error('Fetch error:', error)
        })
    }
  })

  // Обработчик изменения параметров трубы
  feedPipeParams.addEventListener('change', function() {
    if (this.value) {
      feedPipeKt = this.value
      feedPipeKtValue.innerHTML = `${this.value}, л²/с²`

      // Получаем выбранный диаметр трубы
      const selectedOption = this.options[this.selectedIndex]
      const selectedText = selectedOption.text
      const diameterMatch = selectedText.match(/DN\s+(\d+)/)

      if (diameterMatch) {
        const feedPipeDiameter = parseInt(diameterMatch[1])
        filterControlUnitsByDiameter(feedPipeDiameter)
      }

      window.calculateFeedPipe()
    } else {
      feedPipeKt = null
      feedPipeKtValue.innerHTML = ''
      // Сбрасываем фильтр узлов управления
      filterControlUnitsByDiameter(0)
      window.calculateFeedPipe()
    }
  })

  // Функция фильтрации узлов управления по диаметру
  function filterControlUnitsByDiameter(minDiameter) {
    currentMinDiameter = minDiameter
    applyControlUnitFilters()
  }

  // Обработчик изменения длины
  if (feedPipeLength) {
    feedPipeLength.addEventListener('change', window.calculateFeedPipe)
  }

  // Функция сбора детальных данных из таблиц ветвей
  function collectBranchDetails() {
    const branchDetails = {}

    for (const branchNum in kt_values) {
      const branchTable = document.getElementById(`branchTable-${branchNum}`)
      if (!branchTable) continue

      // Проверяем, есть ли результаты расчета для этой ветви
      if (!branch_results[branchNum] || !branch_results[branchNum].Q_total) {
        continue // Пропускаем незаполненные ветви
      }

      const allRows = branchTable.querySelectorAll('tbody > tr')
      const rows = []
      let hasData = false

      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i]
        const rowType = row.getAttribute('data-type')

        if (rowType === 'sprinkler') {
          // Собираем данные оросителя
          const name = row.querySelector('td:first-child')?.textContent.trim() || '-'
          const flow = row.querySelector('td.Q_sprinkler_value')?.textContent.trim() || '-'
          const pressure = row.querySelector('td.P_sprinkler_value')?.textContent.trim() || '-'

          // Проверяем, что есть хоть какие-то данные
          if (flow !== '-' && flow !== '') {
            hasData = true
          }

          rows.push({
            name: name,
            length: '-',
            pressure_loss: '-',
            flow: flow,
            pressure: pressure,
            action: '-',
            is_sprinkler: true
          })
        } else if (rowType === 'section') {
          // Собираем данные участка
          const name = row.querySelector('td:first-child')?.textContent.trim() || '-'
          const lengthInput = row.querySelector('input.section-length')
          const length = lengthInput?.value || '-'
          const pressure_loss = row.querySelector('td.P_loss_value')?.textContent.trim() || '-'
          const flow = row.querySelector('td.Q_section_value')?.textContent.trim() || '-'
          const pressure = row.querySelector('td.P_section_value')?.textContent.trim() || '-'

          rows.push({
            name: name,
            length: length,
            pressure_loss: pressure_loss,
            flow: flow,
            pressure: pressure,
            action: '-',
            is_sprinkler: false
          })
        } else if (rowType === 'node') {
          // Собираем данные узла
          const nodeLabel = row.querySelector('.node-label')?.textContent.trim() || ''
          const name = nodeLabel ? `Узел ${nodeLabel}` : row.querySelector('td:first-child')?.textContent.trim() || '-'
          const length = row.querySelector('.node-length')?.textContent.trim() || '-'
          const pressure_loss = row.querySelector('.node-P-loss')?.textContent.trim() || '-'
          const flow = row.querySelector('.node-Q')?.textContent.trim() || '-'
          const pressure = row.querySelector('.node-P')?.textContent.trim() || '-'

          rows.push({
            name: name,
            length: length,
            pressure_loss: pressure_loss,
            flow: flow,
            pressure: pressure,
            action: '-',
            is_sprinkler: false
          })
        }
      }

      // Добавляем ветвь только если есть данные расчета
      if (hasData && rows.length > 0) {
        branchDetails[`branch-${branchNum}`] = {
          branch_num: getBranchLetter(branchNum),
          kt: kt_values[branchNum],
          rows: rows
        }
      }
    }

    return branchDetails
  }

  // Функция сбора всех данных расчета
  function collectCalculationData() {
    // Собираем данные из формы
    const formData = new FormData(form)
    const formValues = Object.fromEntries(formData.entries())

    // Собираем данные ветвей (старый формат для совместимости)
    const branches = {}
    for (const branchNum in kt_values) {
      branches[branchNum] = {
        kt: kt_values[branchNum],
        results: branch_results[branchNum]
      }
    }

    // Собираем детальные данные ветвей (новый формат)
    const branchDetails = collectBranchDetails()

    // Собираем данные соединений
    const connections = {}
    for (const key in branch_results) {
      if (key.startsWith('connection-')) {
        connections[key] = branch_results[key]
      }
    }

    // Собираем данные питающего трубопровода
    const feedPipe = {
      length: parseFloat(feedPipeLength?.value) || 0,
      kt: feedPipeKt,
      results: branch_results['feed-pipe']
    }

    // Собираем данные узла управления
    const controlUnitRadio = document.querySelector('input[name="control-unit"]:checked')
    let controlUnit = null
    let controlUnitDesignation = null

    if (controlUnitRadio) {
      const row = controlUnitRadio.closest('tr')
      const cells = row.querySelectorAll('td')
      if (cells.length >= 2) {
        controlUnit = cells[0].textContent.trim().replace(/^\s*☑?\s*/, '') // Убираем чекбокс из текста
        controlUnitDesignation = cells[1].textContent.trim()
      }
    }

    // Собираем тип установки
    const installationType = installationTypeSelect?.value

    // Собираем данные оросителя
    const sprinklerSelect = document.getElementById('sprinklers-select')
    const sprinklerType = sprinklerSelect?.options[sprinklerSelect.selectedIndex]?.text || null
    const sprinklerPressure = document.getElementById('H')?.textContent || null
    const sprinklerFlow = document.getElementById('Q1')?.textContent || null
    const sprinklerKFactor = document.getElementById('sprinkler_K')?.textContent || null

    // Собираем график оросителя (конвертируем canvas в base64)
    let sprinklerChartImage = null
    if (sprinklerChart) {
      try {
        const canvas = document.getElementById('sprinkler-chart')
        if (canvas) {
          sprinklerChartImage = canvas.toDataURL('image/png')
        }
      } catch (error) {
        console.error('Ошибка при конвертации графика в base64:', error)
      }
    }

    // Собираем данные о трубе
    const pipeTypeSelect = document.getElementById('pipe-type-select')
    const pipeType = pipeTypeSelect?.options[pipeTypeSelect.selectedIndex]?.text || null
    const pipeDiameterSelect = document.getElementById('pipe-diameter-select')
    const pipeDN = pipeDiameterSelect?.options[pipeDiameterSelect.selectedIndex]?.text || null

    // Вычисляем общие потери (если есть данные)
    let totalLosses = null
    if (branch_results['feed-pipe']?.P_total) {
      totalLosses = branch_results['feed-pipe'].P_total
    }

    return {
      timestamp: new Date().toISOString(),
      formValues,
      installationType,
      branches,
      branchDetails,
      connections,
      feedPipe,
      controlUnit,
      controlUnitDesignation,
      sprinkler: {
        type: sprinklerType,
        pressure: sprinklerPressure,
        flow: sprinklerFlow,
        k_factor: sprinklerKFactor
      },
      sprinklerChartImage,
      pipeType,
      pipeDN,
      totalLosses,
      kt_values,
      branch_results
    }
  }

  // Обработчик кнопки "Сохранить результаты"
  const saveResultsBtn = document.getElementById('save-results-btn')
  if (saveResultsBtn) {
    saveResultsBtn.addEventListener('click', async function() {
      try {
        // Собираем все данные
        const calculationData = collectCalculationData()

        // Отправляем на сервер
        const response = await fetch('/users/save-calculation/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(calculationData)
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        // Переходим на страницу с результатами
        if (result.redirect_url) {
          window.location.href = result.redirect_url
        } else {
          alert(`Результаты успешно сохранены! ID: ${result.id}`)
        }
      } catch (error) {
        console.error('Ошибка при сохранении:', error)
        alert('Произошла ошибка при сохранении результатов')
      }
    })
  }

})