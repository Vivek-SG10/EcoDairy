/* ============================================================
   EcoDairy — Application Logic
   ============================================================ */

(function () {
  'use strict';

  // ── Baseline / Default Parameters ──────────────────────────
  const DEFAULTS = Object.freeze({
    cows: 10,
    methane: 1500,
    electricity: 2000,
    diesel: 150,
    feed: 5000,
    manure: 200,
    elecEF: 0.70,
    dieselEF: 2.68,
    feedEF: 0.50
  });

  // ── Application State ──────────────────────────────────────
  const state = {
    params: { ...DEFAULTS },
    scenarios: {
      biogas:       { enabled: false, value: 50 },
      solar:        { enabled: false, value: 50 },
      feedImprove:  { enabled: false, value: 10 },
      elecReduce:   { enabled: false, value: 20 },
      dieselReduce: { enabled: false, value: 20 }
    },
    predictions: { herdGrowth: 5, elecGrowth: 2, feedGrowth: 3 },
    savedScenarios: [],
    charts: {}
  };

  // Chart colour palette
  const COLORS = ['#2d6a4f', '#f57c00', '#1976d2', '#7b1fa2', '#d32f2f'];
  const SOURCE_LABELS = ['Enteric Methane', 'Electricity', 'Diesel', 'Feed', 'Manure'];

  // ── Helpers ────────────────────────────────────────────────
  function formatNum(n) {
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatPct(n) {
    return n.toFixed(2) + '%';
  }
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }
  function $(id) { return document.getElementById(id); }

  let toastTimer = null;
  function showToast(message) {
    const el = $('toast');
    if (!el) return;
    el.innerHTML = `<span style="display:inline-block;margin-right:6px">🌿</span> ${message}`;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 3500);
  }

  // ── Calculation Engine ─────────────────────────────────────
  function calculate(p) {
    const enteric     = p.cows * p.methane;
    const electricity = p.electricity * p.elecEF;
    const diesel      = p.diesel * p.dieselEF;
    const feed        = p.feed * p.feedEF;
    const manure      = p.cows * p.manure;
    const total       = enteric + electricity + diesel + feed + manure;
    const perCow      = p.cows > 0 ? total / p.cows : 0;
    const totalTonnes = total / 1000;
    return { enteric, electricity, diesel, feed, manure, total, perCow, totalTonnes };
  }

  // Apply active scenarios WITH double-counting prevention
  function applyScenarios(baseCalc, scenarios, params) {
    let enteric     = baseCalc.enteric;
    let electricity = baseCalc.electricity;
    let diesel      = baseCalc.diesel;
    let feed        = baseCalc.feed;
    let manure      = baseCalc.manure;

    // 1. Feed improvement → reduces enteric methane
    if (scenarios.feedImprove.enabled) {
      enteric = enteric * (1 - scenarios.feedImprove.value / 100);
    }

    // 2. Biogas → reduces manure emissions
    if (scenarios.biogas.enabled) {
      manure = manure * (1 - scenarios.biogas.value / 100);
    }

    // 3. Electricity: first apply consumption reduction, then solar
    //    This prevents double-counting.
    let effectiveElecConsumption = params.electricity;
    if (scenarios.elecReduce.enabled) {
      effectiveElecConsumption = effectiveElecConsumption * (1 - scenarios.elecReduce.value / 100);
    }
    let solarFraction = 0;
    if (scenarios.solar.enabled) {
      solarFraction = scenarios.solar.value / 100;
    }
    electricity = effectiveElecConsumption * (1 - solarFraction) * params.elecEF;

    // 4. Diesel reduction
    if (scenarios.dieselReduce.enabled) {
      diesel = diesel * (1 - scenarios.dieselReduce.value / 100);
    }

    // Clamp to zero
    enteric     = Math.max(0, enteric);
    electricity = Math.max(0, electricity);
    diesel      = Math.max(0, diesel);
    feed        = Math.max(0, feed);
    manure      = Math.max(0, manure);

    const total       = enteric + electricity + diesel + feed + manure;
    const perCow      = params.cows > 0 ? total / params.cows : 0;
    const totalTonnes = total / 1000;
    return { enteric, electricity, diesel, feed, manure, total, perCow, totalTonnes };
  }

  // ── Read Inputs → State ────────────────────────────────────
  function readParams() {
    const pairs = [
      ['cows',        'input-cows',        1,    100,   1   ],
      ['methane',     'input-methane',      500,  3000,  10  ],
      ['electricity', 'input-electricity',  0,    20000, 100 ],
      ['diesel',      'input-diesel',       0,    2000,  10  ],
      ['feed',        'input-feed',         0,    50000, 100 ],
      ['manure',      'input-manure',       0,    1000,  10  ],
      ['elecEF',      'input-elecEF',       0.10, 2.00,  0.01],
      ['dieselEF',    'input-dieselEF',     1.00, 5.00,  0.01],
      ['feedEF',      'input-feedEF',       0.10, 2.00,  0.01]
    ];
    pairs.forEach(([key, id, min, max]) => {
      let v = parseFloat($(id).value);
      if (isNaN(v)) v = DEFAULTS[key];
      state.params[key] = clamp(v, min, max);
    });
  }

  function readScenarios() {
    ['biogas', 'solar', 'feedImprove', 'elecReduce', 'dieselReduce'].forEach(s => {
      state.scenarios[s].enabled = $('toggle-' + s).checked;
      state.scenarios[s].value   = parseFloat($('slider-' + s).value);
    });
  }

  function readPredictions() {
    ['herdGrowth', 'elecGrowth', 'feedGrowth'].forEach(k => {
      let v = parseFloat($('input-' + k).value);
      if (isNaN(v)) v = 0;
      state.predictions[k] = clamp(v, -10, 20);
    });
  }

  // ── Dashboard Update ───────────────────────────────────────
  function updateDashboard() {
    const calc = calculate(state.params);

    $('display-totalKg').textContent       = formatNum(calc.total);
    $('display-totalTonnes').textContent    = formatNum(calc.totalTonnes);
    $('display-perCow').textContent         = formatNum(calc.perCow);

    // Impact level
    const impactEl = $('display-impact');
    impactEl.classList.remove('impact-low', 'impact-medium', 'impact-high', 'impact-very-high');
    if (calc.totalTonnes < 10) {
      impactEl.textContent = 'Low';
      impactEl.classList.add('impact-low');
    } else if (calc.totalTonnes < 25) {
      impactEl.textContent = 'Medium';
      impactEl.classList.add('impact-medium');
    } else if (calc.totalTonnes < 50) {
      impactEl.textContent = 'High';
      impactEl.classList.add('impact-high');
    } else {
      impactEl.textContent = 'Very High';
      impactEl.classList.add('impact-very-high');
    }

    // Breakdown table
    const pct = (v) => calc.total > 0 ? formatPct(v / calc.total * 100) : '0.00%';
    $('display-enteric').textContent        = formatNum(calc.enteric);
    $('display-entericPct').textContent      = pct(calc.enteric);
    $('display-electricity').textContent     = formatNum(calc.electricity);
    $('display-electricityPct').textContent   = pct(calc.electricity);
    $('display-diesel').textContent          = formatNum(calc.diesel);
    $('display-dieselPct').textContent        = pct(calc.diesel);
    $('display-feed').textContent            = formatNum(calc.feed);
    $('display-feedPct').textContent          = pct(calc.feed);
    $('display-manure').textContent          = formatNum(calc.manure);
    $('display-manurePct').textContent        = pct(calc.manure);
    $('display-breakdownTotal').innerHTML    = '<strong>' + formatNum(calc.total) + '</strong>';

    // Charts
    updateDoughnutChart(calc);
    updateBarChart(calc);
  }

  // ── Simulator Update ───────────────────────────────────────
  function updateSimulator() {
    const base = calculate(state.params);
    const modified = applyScenarios(base, state.scenarios, state.params);

    // Individual scenario results
    updateScenarioCard('biogas', base.manure,
      base.manure * (1 - (state.scenarios.biogas.enabled ? state.scenarios.biogas.value / 100 : 0)),
      state.scenarios.biogas.enabled, base.total);

    // For solar, we need to account for elecReduce first
    let elecForSolar = base.electricity;
    if (state.scenarios.elecReduce.enabled) {
      elecForSolar = state.params.electricity * (1 - state.scenarios.elecReduce.value / 100) * state.params.elecEF;
    }
    updateScenarioCard('solar', base.electricity,
      state.scenarios.solar.enabled ? elecForSolar * (1 - state.scenarios.solar.value / 100) : base.electricity,
      state.scenarios.solar.enabled, base.total);

    updateScenarioCard('feedImprove', base.enteric,
      base.enteric * (1 - (state.scenarios.feedImprove.enabled ? state.scenarios.feedImprove.value / 100 : 0)),
      state.scenarios.feedImprove.enabled, base.total);

    // For elecReduce, show its isolated effect
    let elecAfterReduce = state.params.electricity * (1 - (state.scenarios.elecReduce.enabled ? state.scenarios.elecReduce.value / 100 : 0)) * state.params.elecEF;
    updateScenarioCard('elecReduce', base.electricity, elecAfterReduce, state.scenarios.elecReduce.enabled, base.total);

    updateScenarioCard('dieselReduce', base.diesel,
      base.diesel * (1 - (state.scenarios.dieselReduce.enabled ? state.scenarios.dieselReduce.value / 100 : 0)),
      state.scenarios.dieselReduce.enabled, base.total);

    // Update slider labels
    ['biogas', 'solar', 'feedImprove', 'elecReduce', 'dieselReduce'].forEach(s => {
      $('label-' + s).textContent = $('slider-' + s).value + '%';
      const card = $('scenario-' + s);
      if (state.scenarios[s].enabled) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Combined results
    const saved = base.total - modified.total;
    const pctReduction = base.total > 0 ? (saved / base.total) * 100 : 0;

    $('sim-originalTotal').textContent = formatNum(base.total);
    $('sim-newTotal').textContent      = formatNum(modified.total);
    $('sim-saved').textContent         = formatNum(saved);
    $('sim-savedTonnes').textContent   = formatNum(saved / 1000) + ' tonnes';
    $('sim-pctReduction').textContent  = formatPct(pctReduction);

    updateComparisonChart(base, modified);
  }

  function updateScenarioCard(suffix, original, newVal, enabled, baseTotal) {
    const origEl = $(suffix + '-original');
    const newEl = $(suffix + '-new');
    const savedEl = $(suffix + '-saved');
    const farmTotalEl = $(suffix + '-farmTotal');
    const pctEl = $(suffix + '-pct');

    if (!enabled) {
      if (origEl) origEl.textContent = '—';
      if (newEl) newEl.textContent = '—';
      if (savedEl) savedEl.textContent = '—';
      if (farmTotalEl) farmTotalEl.textContent = '—';
      if (pctEl) pctEl.textContent = '—';
      return;
    }
    const saved = original - newVal;
    const pct = original > 0 ? (saved / original) * 100 : 0;
    const farmTotal = Math.max(0, (baseTotal || 0) - saved);
    const farmPct = baseTotal > 0 ? (saved / baseTotal) * 100 : 0;

    if (origEl) origEl.textContent = formatNum(original) + ' kg CO₂e';
    if (newEl) newEl.textContent = formatNum(newVal) + ' kg CO₂e';
    if (savedEl) savedEl.textContent = `${formatNum(saved)} kg (${formatNum(saved / 1000)} t CO₂e)`;
    if (farmTotalEl) farmTotalEl.textContent = `${formatNum(farmTotal)} kg (${formatNum(farmTotal / 1000)} t)`;
    if (pctEl) pctEl.textContent = `${formatPct(pct)} source reduction (-${formatPct(farmPct)} total)`;
  }

  // ── Predictions Update ─────────────────────────────────────
  function updatePredictions() {
    const p = state.params;
    const g = state.predictions;
    const years = [0, 1, 2, 3, 4, 5];

    const bauData = [];
    const susData = [];

    years.forEach(n => {
      // Project parameters for year n
      const projected = {
        cows:        Math.max(1, Math.round(p.cows * Math.pow(1 + g.herdGrowth / 100, n))),
        methane:     p.methane,
        electricity: Math.max(0, p.electricity * Math.pow(1 + g.elecGrowth / 100, n)),
        diesel:      Math.max(0, p.diesel * Math.pow(1 + g.herdGrowth / 100, n)), // scales with herd
        feed:        Math.max(0, p.feed * Math.pow(1 + g.feedGrowth / 100, n)),
        manure:      p.manure,
        elecEF:      p.elecEF,
        dieselEF:    p.dieselEF,
        feedEF:      p.feedEF
      };

      const bau = calculate(projected);
      const sus = applyScenarios(bau, state.scenarios, projected);

      bauData.push(bau);
      susData.push(sus);
    });

    // Fill forecast table (Current, Year 1, Year 3, Year 5)
    const tbody = $('forecast-tbody');
    tbody.innerHTML = '';
    const showYears = [
      { label: 'Current', idx: 0 },
      { label: 'Year 1', idx: 1 },
      { label: 'Year 3', idx: 3 },
      { label: 'Year 5', idx: 5 }
    ];
    showYears.forEach(({ label, idx }) => {
      const bau = bauData[idx];
      const sus = susData[idx];
      const savings = bau.totalTonnes - sus.totalTonnes;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${label}</td>
        <td>${formatNum(bau.total)}</td>
        <td>${formatNum(bau.totalTonnes)}</td>
        <td>${formatNum(sus.total)}</td>
        <td>${formatNum(sus.totalTonnes)}</td>
        <td>${formatNum(savings)}</td>
      `;
      tbody.appendChild(tr);
    });

    updateForecastChart(years, bauData, susData);
  }

  // ── Recommendations ────────────────────────────────────────
  function generateRecommendations() {
    const calc = calculate(state.params);
    const recs = [];

    const sources = [
      { key: 'enteric',     label: 'Enteric Methane', value: calc.enteric },
      { key: 'manure',      label: 'Manure Management', value: calc.manure },
      { key: 'electricity', label: 'Electricity', value: calc.electricity },
      { key: 'feed',        label: 'Feed', value: calc.feed },
      { key: 'diesel',      label: 'Diesel', value: calc.diesel }
    ];
    sources.sort((a, b) => b.value - a.value);

    const pct = (v) => calc.total > 0 ? (v / calc.total * 100) : 0;

    // Enteric
    if (pct(calc.enteric) > 40) {
      recs.push({
        title: 'Improve Cattle Feeding Practices',
        priority: 'HIGH',
        priorityClass: 'high',
        target: 'Enteric Methane',
        reason: `Enteric methane accounts for ${formatPct(pct(calc.enteric))} of your total emissions — the single largest source.`,
        savings: `Up to ${formatNum(calc.enteric * 0.15)} kg CO₂e/year with a 15% reduction in enteric emissions.`,
        action: 'Consult a qualified livestock nutrition professional about locally appropriate feeding and herd-management improvements.'
      });
    } else if (pct(calc.enteric) > 20) {
      recs.push({
        title: 'Monitor Enteric Methane',
        priority: 'MEDIUM',
        priorityClass: 'medium',
        target: 'Enteric Methane',
        reason: `Enteric methane accounts for ${formatPct(pct(calc.enteric))} of emissions.`,
        savings: `Potential savings of ${formatNum(calc.enteric * 0.10)} kg CO₂e/year with improved feeding.`,
        action: 'Evaluate feed efficiency and consult with an animal nutritionist about diet optimisation.'
      });
    }

    // Manure
    if (pct(calc.manure) > 10) {
      recs.push({
        title: 'Adopt Improved Manure Management',
        priority: pct(calc.manure) > 15 ? 'HIGH' : 'MEDIUM',
        priorityClass: pct(calc.manure) > 15 ? 'high' : 'medium',
        target: 'Manure Management',
        reason: `Manure management contributes ${formatPct(pct(calc.manure))} of total emissions.`,
        savings: `Up to ${formatNum(calc.manure * 0.50)} kg CO₂e/year with a biogas digester (50% capture).`,
        action: 'Assess feasibility of anaerobic digestion, biogas production, covered storage, or improved manure handling.'
      });
    }

    // Electricity
    if (pct(calc.electricity) > 5) {
      recs.push({
        title: 'Reduce Electricity Emissions',
        priority: pct(calc.electricity) > 15 ? 'HIGH' : 'MEDIUM',
        priorityClass: pct(calc.electricity) > 15 ? 'high' : 'medium',
        target: 'Electricity',
        reason: `Electricity usage contributes ${formatPct(pct(calc.electricity))} of emissions.`,
        savings: `Up to ${formatNum(calc.electricity * 0.50)} kg CO₂e/year by replacing 50% with solar.`,
        action: 'Evaluate solar-powered systems, energy-efficient pumps, LED lighting, and regular equipment maintenance.'
      });
    }

    // Feed
    if (pct(calc.feed) > 8) {
      recs.push({
        title: 'Optimise Feed Sourcing & Reduce Waste',
        priority: 'MEDIUM',
        priorityClass: 'medium',
        target: 'Feed Production',
        reason: `Feed-related emissions account for ${formatPct(pct(calc.feed))} of total emissions.`,
        savings: `Reducing feed waste by 10% could save ${formatNum(calc.feed * 0.10)} kg CO₂e/year.`,
        action: 'Reduce feed waste, evaluate responsibly sourced and nutritionally appropriate feed options.'
      });
    }

    // Diesel
    if (pct(calc.diesel) > 3) {
      recs.push({
        title: 'Reduce Diesel Consumption',
        priority: 'LOW',
        priorityClass: 'low',
        target: 'Diesel',
        reason: `Diesel contributes ${formatPct(pct(calc.diesel))} of farm emissions.`,
        savings: `A 20% reduction would save approximately ${formatNum(calc.diesel * 0.20)} kg CO₂e/year.`,
        action: 'Reduce unnecessary trips, maintain machinery regularly, and optimise farm vehicle routes.'
      });
    }

    // Ensure at least 2 recommendations
    if (recs.length < 2) {
      recs.push({
        title: 'Conduct a Comprehensive Farm Energy Audit',
        priority: 'MEDIUM',
        priorityClass: 'medium',
        target: 'All Sources',
        reason: 'A holistic assessment helps identify the most cost-effective reduction opportunities.',
        savings: 'Varies depending on audit findings.',
        action: 'Engage an agricultural sustainability consultant for a site-specific assessment.'
      });
    }
    if (recs.length < 2) {
      recs.push({
        title: 'Track Emissions Over Time',
        priority: 'LOW',
        priorityClass: 'low',
        target: 'All Sources',
        reason: 'Monitoring trends helps you measure progress and identify emerging issues.',
        savings: 'Indirect — better data leads to better decisions.',
        action: 'Use this tool regularly to track your farm\'s emission profile and compare scenarios.'
      });
    }

    return recs;
  }

  function updateRecommendations() {
    const recs = generateRecommendations();
    const container = $('recommendations-container');
    container.innerHTML = '';

    recs.forEach(rec => {
      const card = document.createElement('div');
      card.className = `recommendation-card priority-${rec.priorityClass}`;
      card.innerHTML = `
        <div class="rec-header">
          <span class="rec-priority priority-badge-${rec.priorityClass}">${rec.priority} PRIORITY</span>
          <span class="rec-target">Targets: ${rec.target}</span>
        </div>
        <h3 class="rec-title">${rec.title}</h3>
        <p class="rec-reason"><strong>Why:</strong> ${rec.reason}</p>
        <p class="rec-savings"><strong>Estimated savings:</strong> ${rec.savings}</p>
        <p class="rec-action"><strong>Next step:</strong> ${rec.action}</p>
      `;
      container.appendChild(card);
    });
  }

  // ── Comparison Table ───────────────────────────────────────
  function updateComparison() {
    const baseline = calculate(DEFAULTS);
    const current  = calculate(state.params);
    const currentWithScenarios = applyScenarios(current, state.scenarios, state.params);

    // Build header
    const thead = $('compare-thead');
    let headerHTML = '<tr><th>Metric</th><th>Baseline</th><th>Current</th>';
    // Current with scenarios if any are active
    const anyActive = Object.values(state.scenarios).some(s => s.enabled);
    if (anyActive) {
      headerHTML += '<th>Current + Interventions</th>';
    }
    state.savedScenarios.forEach(s => {
      headerHTML += `<th>${s.name}</th>`;
    });
    headerHTML += '</tr>';
    thead.innerHTML = headerHTML;

    // Build rows
    const metrics = [
      { label: 'Total Emissions (kg CO₂e)',     fn: c => formatNum(c.total) },
      { label: 'Total Emissions (tonnes CO₂e)', fn: c => formatNum(c.totalTonnes) },
      { label: 'Emissions per Cow (kg CO₂e)',   fn: c => formatNum(c.perCow) },
      { label: 'Enteric Methane (kg CO₂e)',      fn: c => formatNum(c.enteric) },
      { label: 'Electricity (kg CO₂e)',          fn: c => formatNum(c.electricity) },
      { label: 'Diesel (kg CO₂e)',               fn: c => formatNum(c.diesel) },
      { label: 'Feed (kg CO₂e)',                 fn: c => formatNum(c.feed) },
      { label: 'Manure (kg CO₂e)',               fn: c => formatNum(c.manure) },
      { label: 'Savings vs Baseline (kg CO₂e)',  fn: c => formatNum(Math.max(0, baseline.total - c.total)) },
      { label: 'Reduction vs Baseline (%)',      fn: c => baseline.total > 0 ? formatPct((baseline.total - c.total) / baseline.total * 100) : '0.00%' }
    ];

    const tbody = $('compare-tbody');
    tbody.innerHTML = '';
    metrics.forEach(m => {
      let row = `<tr><td>${m.label}</td><td>${m.fn(baseline)}</td><td>${m.fn(current)}</td>`;
      if (anyActive) {
        row += `<td>${m.fn(currentWithScenarios)}</td>`;
      }
      state.savedScenarios.forEach(s => {
        row += `<td>${m.fn(s.results)}</td>`;
      });
      row += '</tr>';
      tbody.innerHTML += row;
    });

    // Comparison bar chart
    const labels = ['Baseline', 'Current'];
    const data = [baseline.total, current.total];
    if (anyActive) {
      labels.push('Current + Interventions');
      data.push(currentWithScenarios.total);
    }
    state.savedScenarios.forEach(s => {
      labels.push(s.name);
      data.push(s.results.total);
    });
    updateCompareBarChart(labels, data);
  }

  // ── Charts ─────────────────────────────────────────────────

  function updateDoughnutChart(calc) {
    const data = [calc.enteric, calc.electricity, calc.diesel, calc.feed, calc.manure];
    if (state.charts.doughnut) {
      state.charts.doughnut.data.datasets[0].data = data;
      state.charts.doughnut.update();
    } else {
      state.charts.doughnut = new Chart($('chart-doughnut'), {
        type: 'doughnut',
        data: {
          labels: SOURCE_LABELS,
          datasets: [{
            data: data,
            backgroundColor: COLORS,
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 15, font: { size: 12 } } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.label}: ${formatNum(ctx.parsed)} kg CO₂e (${(ctx.parsed / (ctx.dataset.data.reduce((a, b) => a + b, 0) || 1) * 100).toFixed(1)}%)`
              }
            }
          }
        }
      });
    }
  }

  function updateBarChart(calc) {
    const data = [calc.enteric, calc.electricity, calc.diesel, calc.feed, calc.manure];
    if (state.charts.bar) {
      state.charts.bar.data.datasets[0].data = data;
      state.charts.bar.update();
    } else {
      state.charts.bar = new Chart($('chart-bar'), {
        type: 'bar',
        data: {
          labels: SOURCE_LABELS,
          datasets: [{
            label: 'Emissions (kg CO₂e)',
            data: data,
            backgroundColor: COLORS,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => `${formatNum(ctx.parsed.x)} kg CO₂e`
              }
            }
          },
          scales: {
            x: { beginAtZero: true, ticks: { callback: v => (v / 1000).toFixed(1) + 'k' } }
          }
        }
      });
    }
  }

  function updateComparisonChart(base, modified) {
    const baseData = [base.enteric, base.electricity, base.diesel, base.feed, base.manure];
    const modData  = [modified.enteric, modified.electricity, modified.diesel, modified.feed, modified.manure];

    if (state.charts.comparison) {
      state.charts.comparison.data.datasets[0].data = baseData;
      state.charts.comparison.data.datasets[1].data = modData;
      state.charts.comparison.update();
    } else {
      state.charts.comparison = new Chart($('chart-comparison'), {
        type: 'bar',
        data: {
          labels: SOURCE_LABELS,
          datasets: [
            { label: 'Before', data: baseData, backgroundColor: 'rgba(45,106,79,0.4)', borderColor: '#2d6a4f', borderWidth: 1, borderRadius: 4 },
            { label: 'After Interventions', data: modData, backgroundColor: 'rgba(82,183,136,0.6)', borderColor: '#52b788', borderWidth: 1, borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'top' },
            tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatNum(ctx.parsed.y)} kg CO₂e` } }
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => (v / 1000).toFixed(1) + 'k' } }
          }
        }
      });
    }
  }

  function updateForecastChart(years, bauData, susData) {
    const bauTotals = bauData.map(d => d.totalTonnes);
    const susTotals = susData.map(d => d.totalTonnes);
    const labels = years.map(y => y === 0 ? 'Current' : `Year ${y}`);

    if (state.charts.forecast) {
      state.charts.forecast.data.labels = labels;
      state.charts.forecast.data.datasets[0].data = bauTotals;
      state.charts.forecast.data.datasets[1].data = susTotals;
      state.charts.forecast.update();
    } else {
      state.charts.forecast = new Chart($('chart-forecast'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Business as Usual',
              data: bauTotals,
              borderColor: '#d32f2f',
              backgroundColor: 'rgba(211,47,47,0.1)',
              borderWidth: 2.5,
              fill: true,
              tension: 0.3,
              pointRadius: 5,
              pointBackgroundColor: '#d32f2f'
            },
            {
              label: 'Sustainable Scenario',
              data: susTotals,
              borderColor: '#2d6a4f',
              backgroundColor: 'rgba(45,106,79,0.1)',
              borderWidth: 2.5,
              fill: true,
              tension: 0.3,
              pointRadius: 5,
              pointBackgroundColor: '#2d6a4f'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'top' },
            tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatNum(ctx.parsed.y)} tonnes CO₂e` } }
          },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Tonnes CO₂e' } }
          }
        }
      });
    }
  }

  function updateCompareBarChart(labels, data) {
    const bgColors = data.map((_, i) => {
      if (i === 0) return 'rgba(45,106,79,0.5)';          // baseline
      if (i === 1) return 'rgba(25,118,210,0.5)';         // current
      if (i === 2) return 'rgba(56,142,60,0.5)';          // interventions
      return `hsla(${(i * 60) % 360}, 60%, 50%, 0.5)`;
    });
    const borderColors = data.map((_, i) => {
      if (i === 0) return '#2d6a4f';
      if (i === 1) return '#1976d2';
      if (i === 2) return '#388e3c';
      return `hsl(${(i * 60) % 360}, 60%, 40%)`;
    });

    if (state.charts.compareBar) {
      state.charts.compareBar.data.labels = labels;
      state.charts.compareBar.data.datasets[0].data = data;
      state.charts.compareBar.data.datasets[0].backgroundColor = bgColors;
      state.charts.compareBar.data.datasets[0].borderColor = borderColors;
      state.charts.compareBar.update();
    } else {
      state.charts.compareBar = new Chart($('chart-compare-bar'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Total Emissions (kg CO₂e)',
            data: data,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${formatNum(ctx.parsed.y)} kg CO₂e (${formatNum(ctx.parsed.y / 1000)} tonnes)` } }
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => (v / 1000).toFixed(1) + 'k' } }
          }
        }
      });
    }
  }

  // ── LocalStorage ───────────────────────────────────────────
  function saveScenariosToStorage() {
    try {
      localStorage.setItem('ecodairy_scenarios', JSON.stringify(state.savedScenarios));
    } catch (e) { /* quota exceeded — ignore */ }
  }

  function loadScenariosFromStorage() {
    try {
      const raw = localStorage.getItem('ecodairy_scenarios');
      if (raw) state.savedScenarios = JSON.parse(raw);
    } catch (e) { state.savedScenarios = []; }
  }

  function saveCurrentScenario(name) {
    const base = calculate(state.params);
    const modified = applyScenarios(base, state.scenarios, state.params);
    state.savedScenarios.push({
      name: name,
      timestamp: new Date().toISOString(),
      params: { ...state.params },
      scenarios: JSON.parse(JSON.stringify(state.scenarios)),
      results: modified
    });
    saveScenariosToStorage();
    updateComparison();
    showToast(`Scenario "${name}" saved to comparison!`);
  }

  // ── Export CSV ─────────────────────────────────────────────
  function exportCSV() {
    const calc = calculate(state.params);
    const modified = applyScenarios(calc, state.scenarios, state.params);
    const anyActive = Object.values(state.scenarios).some(s => s.enabled);

    let csv = 'Source,Emissions (kg CO₂e),Percentage (%)';
    if (anyActive) csv += ',After Interventions (kg CO₂e),Savings (kg CO₂e)';
    csv += '\n';

    const sources = [
      ['Enteric Methane', calc.enteric, modified.enteric],
      ['Electricity', calc.electricity, modified.electricity],
      ['Diesel', calc.diesel, modified.diesel],
      ['Feed', calc.feed, modified.feed],
      ['Manure Management', calc.manure, modified.manure]
    ];

    sources.forEach(([name, original, afterVal]) => {
      const pctVal = calc.total > 0 ? (original / calc.total * 100).toFixed(2) : '0.00';
      csv += `${name},${original.toFixed(2)},${pctVal}`;
      if (anyActive) csv += `,${afterVal.toFixed(2)},${(original - afterVal).toFixed(2)}`;
      csv += '\n';
    });

    csv += `\nTotal,${calc.total.toFixed(2)},100.00`;
    if (anyActive) csv += `,${modified.total.toFixed(2)},${(calc.total - modified.total).toFixed(2)}`;
    csv += '\n';
    csv += `\nTotal (tonnes),${calc.totalTonnes.toFixed(2)}`;
    if (anyActive) csv += `,,${modified.totalTonnes.toFixed(2)}`;
    csv += '\n';

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ecodairy_emissions_report.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Emissions report exported as CSV.');
  }

  // ── Print Report ───────────────────────────────────────────
  function printReport() {
    const calc = calculate(state.params);
    const modified = applyScenarios(calc, state.scenarios, state.params);
    const anyActive = Object.values(state.scenarios).some(s => s.enabled);
    const recs = generateRecommendations();

    const now = new Date().toLocaleString();

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>EcoDairy Report</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 2rem auto; color: #1a1a2e; line-height: 1.6; padding: 0 1rem; }
      h1 { color: #2d6a4f; border-bottom: 2px solid #d8f3dc; padding-bottom: 0.5rem; }
      h2 { color: #1b4332; margin-top: 1.5rem; }
      table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
      th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid #e0e0e0; }
      th { background: #d8f3dc; color: #1b4332; font-size: 0.85rem; text-transform: uppercase; }
      .total-row { background: #d8f3dc; font-weight: 600; }
      .rec { border-left: 3px solid #f57c00; padding: 0.75rem 1rem; margin: 0.75rem 0; background: #fafafa; }
      .rec-high { border-left-color: #d32f2f; }
      .rec-low { border-left-color: #1976d2; }
      .formula { background: #f4f7f4; border: 1px solid #e0e0e0; padding: 1rem; font-family: monospace; font-size: 0.85rem; margin: 1rem 0; }
      .meta { color: #888; font-size: 0.85rem; }
      @media print { body { margin: 0; } }
    </style></head><body>`;

    html += `<h1>🌿 EcoDairy — Sustainability Report</h1>`;
    html += `<p class="meta">Generated: ${now}</p>`;

    html += `<h2>Farm Parameters</h2>`;
    html += `<table><tr><th>Parameter</th><th>Value</th></tr>`;
    html += `<tr><td>Number of Cows</td><td>${state.params.cows}</td></tr>`;
    html += `<tr><td>Methane per Cow</td><td>${formatNum(state.params.methane)} kg CO₂e/yr</td></tr>`;
    html += `<tr><td>Electricity Consumption</td><td>${formatNum(state.params.electricity)} kWh/yr</td></tr>`;
    html += `<tr><td>Diesel Consumption</td><td>${formatNum(state.params.diesel)} litres/yr</td></tr>`;
    html += `<tr><td>Purchased Feed</td><td>${formatNum(state.params.feed)} kg/yr</td></tr>`;
    html += `<tr><td>Manure per Cow</td><td>${formatNum(state.params.manure)} kg CO₂e/yr</td></tr>`;
    html += `<tr><td>Electricity EF</td><td>${state.params.elecEF} kg CO₂e/kWh</td></tr>`;
    html += `<tr><td>Diesel EF</td><td>${state.params.dieselEF} kg CO₂e/L</td></tr>`;
    html += `<tr><td>Feed EF</td><td>${state.params.feedEF} kg CO₂e/kg</td></tr>`;
    html += `</table>`;

    html += `<h2>Emissions Breakdown</h2>`;
    html += `<table><tr><th>Source</th><th>Emissions (kg CO₂e)</th><th>%</th>`;
    if (anyActive) html += `<th>After Interventions</th><th>Saved</th>`;
    html += `</tr>`;
    const srcs = [
      ['Enteric Methane', calc.enteric, modified.enteric],
      ['Electricity', calc.electricity, modified.electricity],
      ['Diesel', calc.diesel, modified.diesel],
      ['Feed', calc.feed, modified.feed],
      ['Manure Management', calc.manure, modified.manure]
    ];
    srcs.forEach(([n, o, a]) => {
      const p = calc.total > 0 ? (o / calc.total * 100).toFixed(2) + '%' : '0%';
      html += `<tr><td>${n}</td><td>${formatNum(o)}</td><td>${p}</td>`;
      if (anyActive) html += `<td>${formatNum(a)}</td><td>${formatNum(o - a)}</td>`;
      html += `</tr>`;
    });
    html += `<tr class="total-row"><td><strong>Total</strong></td><td><strong>${formatNum(calc.total)}</strong></td><td>100%</td>`;
    if (anyActive) html += `<td><strong>${formatNum(modified.total)}</strong></td><td><strong>${formatNum(calc.total - modified.total)}</strong></td>`;
    html += `</tr></table>`;

    html += `<p><strong>Total: ${formatNum(calc.totalTonnes)} tonnes CO₂e/year</strong></p>`;
    if (anyActive) {
      const saved = calc.total - modified.total;
      html += `<p><strong>After Interventions: ${formatNum(modified.totalTonnes)} tonnes CO₂e/year</strong></p>`;
      html += `<p><strong>Savings: ${formatNum(saved / 1000)} tonnes (${formatPct(saved / calc.total * 100)} reduction)</strong></p>`;
    }

    html += `<h2>Recommendations</h2>`;
    recs.forEach(rec => {
      const cls = rec.priorityClass === 'high' ? 'rec rec-high' : (rec.priorityClass === 'low' ? 'rec rec-low' : 'rec');
      html += `<div class="${cls}">`;
      html += `<strong>[${rec.priority}] ${rec.title}</strong> — Targets: ${rec.target}<br>`;
      html += `Why: ${rec.reason}<br>`;
      html += `Estimated savings: ${rec.savings}<br>`;
      html += `Next step: ${rec.action}`;
      html += `</div>`;
    });

    html += `<h2>Methodology</h2>`;
    html += `<div class="formula">`;
    html += `Enteric = Cows × Methane/Cow<br>`;
    html += `Electricity = kWh × EF<br>`;
    html += `Diesel = Litres × EF<br>`;
    html += `Feed = kg × EF<br>`;
    html += `Manure = Cows × Manure/Cow<br>`;
    html += `Total = Sum of all sources</div>`;

    html += `<p class="meta">Values are illustrative assumptions for educational purposes. This report was generated by EcoDairy, an EVS microproject for ISE students.</p>`;
    html += `</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  // ── Navigation ─────────────────────────────────────────────
  function navigate(sectionName) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const section = $('section-' + sectionName);
    if (section) section.classList.add('active');
    const link = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
    if (link) link.classList.add('active');
    // Close mobile menu
    $('main-nav').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Resize charts to adjust to newly visible container dimensions
    setTimeout(() => {
      Object.values(state.charts).forEach(c => {
        if (c && typeof c.resize === 'function') {
          c.resize();
          c.update();
        }
      });
      if (window.lucide) lucide.createIcons();
    }, 50);
  }

  // ── Reset ──────────────────────────────────────────────────
  function resetToBaseline() {
    // Reset params
    Object.assign(state.params, DEFAULTS);
    // Reset inputs
    const paramMap = {
      cows: DEFAULTS.cows, methane: DEFAULTS.methane, electricity: DEFAULTS.electricity,
      diesel: DEFAULTS.diesel, feed: DEFAULTS.feed, manure: DEFAULTS.manure,
      elecEF: DEFAULTS.elecEF, dieselEF: DEFAULTS.dieselEF, feedEF: DEFAULTS.feedEF
    };
    Object.entries(paramMap).forEach(([key, val]) => {
      const inputId = key === 'elecEF' ? 'input-elecEF' :
                      key === 'dieselEF' ? 'input-dieselEF' :
                      key === 'feedEF' ? 'input-feedEF' : 'input-' + key;
      const sliderId = key === 'elecEF' ? 'slider-elecEF' :
                       key === 'dieselEF' ? 'slider-dieselEF' :
                       key === 'feedEF' ? 'slider-feedEF' : 'slider-' + key;
      $(inputId).value = val;
      $(sliderId).value = val;
    });

    // Reset scenarios
    ['biogas', 'solar', 'feedImprove', 'elecReduce', 'dieselReduce'].forEach(s => {
      $('toggle-' + s).checked = false;
      state.scenarios[s].enabled = false;
    });
    $('slider-biogas').value = 50;
    $('slider-solar').value = 50;
    $('slider-feedImprove').value = 10;
    $('slider-elecReduce').value = 20;
    $('slider-dieselReduce').value = 20;

    // Reset predictions
    $('input-herdGrowth').value = 5; $('slider-herdGrowth').value = 5;
    $('input-elecGrowth').value = 2; $('slider-elecGrowth').value = 2;
    $('input-feedGrowth').value = 3; $('slider-feedGrowth').value = 3;
    state.predictions = { herdGrowth: 5, elecGrowth: 2, feedGrowth: 3 };

    updateAll();
  }

  // ── Master Update ──────────────────────────────────────────
  function updateAll() {
    readParams();
    readScenarios();
    readPredictions();
    updateDashboard();
    updateSimulator();
    updatePredictions();
    updateRecommendations();
    updateComparison();
  }

  // ── Input Sync (slider ↔ number) ──────────────────────────
  function syncInputs(sliderId, inputId) {
    const slider = $(sliderId);
    const input  = $(inputId);
    slider.addEventListener('input', () => { input.value = slider.value; updateAll(); });
    input.addEventListener('input',  () => {
      let v = parseFloat(input.value);
      const min = parseFloat(input.min);
      const max = parseFloat(input.max);
      if (!isNaN(v)) {
        v = clamp(v, min, max);
        slider.value = v;
      }
      updateAll();
    });
    input.addEventListener('blur', () => {
      let v = parseFloat(input.value);
      const min = parseFloat(input.min);
      const max = parseFloat(input.max);
      if (isNaN(v)) v = parseFloat(slider.value);
      v = clamp(v, min, max);
      input.value = v;
      slider.value = v;
      updateAll();
    });
  }

  // ── Initialisation ─────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // Initialise Lucide icons
    if (window.lucide) lucide.createIcons();

    // Sync param inputs
    const paramPairs = [
      ['slider-cows',       'input-cows'],
      ['slider-methane',    'input-methane'],
      ['slider-electricity','input-electricity'],
      ['slider-diesel',     'input-diesel'],
      ['slider-feed',       'input-feed'],
      ['slider-manure',     'input-manure'],
      ['slider-elecEF',     'input-elecEF'],
      ['slider-dieselEF',   'input-dieselEF'],
      ['slider-feedEF',     'input-feedEF']
    ];
    paramPairs.forEach(([s, i]) => syncInputs(s, i));

    // Scenario toggles & sliders
    ['biogas', 'solar', 'feedImprove', 'elecReduce', 'dieselReduce'].forEach(s => {
      $('toggle-' + s).addEventListener('change', updateAll);
      $('slider-' + s).addEventListener('input', () => {
        $('label-' + s).textContent = $('slider-' + s).value + '%';
        updateAll();
      });
    });

    // Prediction inputs
    ['herdGrowth', 'elecGrowth', 'feedGrowth'].forEach(k => {
      syncInputs('slider-' + k, 'input-' + k);
    });

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        navigate(link.dataset.section);
      });
    });

    // Mobile menu toggle
    $('menu-toggle').addEventListener('click', () => {
      $('main-nav').classList.toggle('open');
    });

    // Reset & Case Study
    $('btn-reset').addEventListener('click', () => {
      resetToBaseline();
      showToast('All farm parameters reset to baseline.');
    });
    $('btn-load-case-study').addEventListener('click', () => {
      resetToBaseline();
      showToast("Lakshmi's 10-Cow Case Study baseline loaded.");
    });

    // Save scenario modal
    $('btn-save-scenario').addEventListener('click', () => {
      $('modal-save').classList.add('active');
      $('scenario-name-input').value = '';
      $('scenario-name-input').focus();
    });
    $('btn-confirm-save').addEventListener('click', () => {
      const name = $('scenario-name-input').value.trim() || `Scenario ${state.savedScenarios.length + 1}`;
      saveCurrentScenario(name);
      $('modal-save').classList.remove('active');
    });
    $('btn-cancel-save').addEventListener('click', () => {
      $('modal-save').classList.remove('active');
    });
    $('modal-save').addEventListener('click', e => {
      if (e.target === $('modal-save')) $('modal-save').classList.remove('active');
    });

    // Clear saved scenarios
    $('btn-clear-scenarios').addEventListener('click', () => {
      if (state.savedScenarios.length === 0) {
        showToast('No saved scenarios to clear.');
        return;
      }
      state.savedScenarios = [];
      saveScenariosToStorage();
      updateComparison();
      showToast('Cleared all saved scenarios.');
    });

    // Export CSV
    $('btn-export-csv').addEventListener('click', exportCSV);

    // Print Report
    $('btn-print-report').addEventListener('click', printReport);

    // Load saved scenarios from storage
    loadScenariosFromStorage();

    // Initial render
    updateAll();
  });

})();
