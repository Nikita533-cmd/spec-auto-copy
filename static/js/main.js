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

  let is_form_submited = false;

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
    values.thermal_lock = thermalLockEl.value
    values.mounting_position = mountingPositionEl.value

    if(show_results) getCaclulationResults(values)
  }

  // вызываем расчет при дефолтных параметрах
  // calculate()

  async function getCaclulationResults(data) {
    try {
      const response = await fetch("/irrigation/intensity/", {
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
        graph_container_el = document.querySelector('#graph-container'),
        results_block_el = document.querySelector('#results-block'),    
        required_irrigation_intensity_el = document.querySelector('#required_irrigation_intensity'),
        sprinklers_list_el = document.querySelector('#sprinklers-list tbody'),      
        sprinklers_block_el = document.querySelector('#sprinklers-block');
    
    results_block_el.classList.remove("d-none")
    graph_container_el.classList.remove("d-none")
    sprinklers_block_el.classList.remove("d-none")

    let
        irrigation_intensit = "ошибка в исходных данных"

    if(data.required_irrigation_intensity){
       irrigation_intensit = `не менее <b>${data.required_irrigation_intensity} дм&sup3;/(с·м&sup2;)</b>`
    }
    required_irrigation_intensity_el.innerHTML = irrigation_intensit

    // удаляем старый график, если он есть //
    drop_graph()

    sprinklers_list_el.innerHTML = '';
    data.sprinklers.forEach(sprinkler => {
      let new_sprinkler_html = `
        <tr>
          <td nowrap="nowrap">
            <input class="form-check-input sprinkler" type="radio" name="sprinkler" id="sprinkler-${sprinkler.id}" value="${sprinkler.id}">
            <label class="form-check-label mx-2" for="sprinkler-${sprinkler.id}">
              ${sprinkler.name}
            </label>
          </td>
          <td class="text-center d-none d-sm-block">${sprinkler.intensity}</td>
          <td class="text-center">${sprinkler.p_work}</td>
        </tr>
      `
      sprinklers_list_el.innerHTML += new_sprinkler_html
    })

    document.querySelectorAll('#sprinklers-list tbody input.sprinkler').forEach((sprinkler, index) => {
      const sprinkler_id = sprinkler.value
      if(index == 0){
        // выбираем первый ороситель и показываем его график
        sprinkler.checked=true
        show_graph(sprinkler_id)
      }
      sprinkler.addEventListener("click", (event) => show_graph(sprinkler_id))
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

  function drop_graph(){
    // удаляем старый график, если он есть //
    let chart = Chart.getChart("chart")
    if (chart != undefined) chart.destroy()
  }

  async function show_graph(sprinkler_id){
    // график //

    drop_graph()

    try {
      const response = await fetch(`/irrigation/graph-data/${sprinkler_id}/`)
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

      const 
        chart_el = document.getElementById('chart'),
        myChart = new Chart(chart_el, config);
    } catch (error) {
      console.error(error.message)
    }
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
})
