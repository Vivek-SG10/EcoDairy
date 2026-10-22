# EcoDairy: Smart Carbon Footprint Analyzer for Dairy Farms

An interactive Environmental Studies (EVS) microproject designed for **Information Science and Engineering (ISE)** students.

---

## 📌 Project Overview
**EcoDairy** is a client-side web application for modeling, visualizing, and forecasting greenhouse gas (GHG) emissions from dairy farms. It provides interactive **"What if?"** scenario simulation, multi-year forecasting, personalized sustainability decision-support, side-by-side scenario comparisons, CSV data export, and printable sustainability reporting.

### Case Study: Lakshmi's 10-Cow Dairy Farm
Lakshmi owns a dairy farm with 10 cows. She aims to understand her annual carbon footprint and identify targeted, cost-effective interventions that lower greenhouse gas emissions without compromising milk production or animal welfare.

---

## 🧮 Mathematical Model & Baseline Data

| Activity / Parameter | Baseline Value | Emission Factor | Formula | Baseline Emissions |
|---|---|---|---|---|
| **Enteric Methane** | 10 cows | 1,500 kg CO₂e / cow / yr | $\text{Cows} \times \text{Methane/cow}$ | **15,000.00 kg CO₂e** (70.42%) |
| **Electricity** | 2,000 kWh / yr | 0.70 kg CO₂e / kWh | $\text{kWh} \times \text{EF}_{\text{elec}}$ | **1,400.00 kg CO₂e** (6.57%) |
| **Diesel Fuel** | 150 L / yr | 2.68 kg CO₂e / L | $\text{Litres} \times \text{EF}_{\text{diesel}}$ | **402.00 kg CO₂e** (1.89%) |
| **Purchased Feed** | 5,000 kg / yr | 0.50 kg CO₂e / kg | $\text{Feed} \times \text{EF}_{\text{feed}}$ | **2,500.00 kg CO₂e** (11.74%) |
| **Manure Management** | 10 cows | 200 kg CO₂e / cow / yr | $\text{Cows} \times \text{Manure/cow}$ | **2,000.00 kg CO₂e** (9.39%) |
| **Total Baseline** | — | — | $\sum \text{All Sources}$ | **21,302.00 kg CO₂e (21.30 t CO₂e)** |
| **Per Cow** | — | — | $\text{Total} / 10$ | **2,130.20 kg CO₂e / cow** |

*Note: All values and emission factors represent illustrative educational assumptions for demonstration.*

---

## 🚀 Key Features

1. **Interactive Real-Time Dashboard**
   - Immediate baseline calculation upon launch.
   - Dynamic Doughnut Chart & Horizontal Bar Chart (powered by Chart.js).
   - Visual Impact Rating Indicator (Low, Medium, High, Very High).
   - Bidirectional synced range sliders and numeric inputs with input clamping and error protection.

2. **"What If?" Scenario Simulator**
   - **Scenario 1: Biogas Digester** (0–80% reduction in manure emissions).
   - **Scenario 2: Solar-Powered Systems** (0–100% replacement of grid electricity).
   - **Scenario 3: Dietary Optimization** (0–20% reduction in enteric methane).
   - **Scenario 4: Energy Efficiency** (0–50% reduction in electricity consumption).
   - **Scenario 5: Fuel Conservation** (0–50% reduction in diesel usage).
   - **Scenario 6: Combined Interventions with Double-Counting Prevention**: sequential application ensures energy efficiency savings are accounted for before solar offsets are applied.

3. **Multi-Year Predictive Forecasting**
   - Projects emissions over 1, 3, and 5 years.
   - Compares **Business-as-Usual (BAU)** against the **Sustainable Scenario**.
   - Formula: $A_n = A_0 \times (1 + r)^n$ applied per activity.
   - Interactive comparative multi-line forecast chart.

4. **Personalized Sustainability Recommendation Engine**
   - Evaluates the farm's unique emissions profile.
   - Generates ranked recommendations (High, Medium, Low priority) targeting the largest contributors.
   - Displays rationale, estimated CO₂e savings, and practical, actionable next steps.

5. **Scenario Comparison & LocalStorage Persistence**
   - Save custom scenarios to browser `LocalStorage`.
   - Side-by-side comparative table with baseline, current, and custom configurations.
   - Comparative multi-series bar chart.

6. **Reporting & Data Export**
   - **CSV Export**: Instant download of emissions breakdown and intervention delta.
   - **Printable Sustainability Report**: Generates a clean, print-optimized document ready for physical printing or PDF export (`Ctrl + P`).

---

## 💻 Information Science & Engineering Concepts Demonstrated

- **Mathematical Modeling**: Activity-based carbon accounting algorithm with boundary constraints and non-negative clamping.
- **Client-Side State Management**: Centralized reactive state pattern ensuring seamless synchronization across multiple UI components.
- **Data Visualization**: Chart.js integration with reactive canvas resizing and custom green-hued color palette.
- **Decision Support Systems (DSS)**: Rule-based heuristic recommendation engine prioritizing high-yield environmental interventions.
- **Client-Side Storage**: Web Storage API (`localStorage`) for scenario preservation across sessions.
- **Accessible & Responsive Web Design**: CSS Grid, Flexbox, custom range sliders, mobile menu toggle, and print stylesheets.

---

## 🏃 How to Run Locally

Because EcoDairy uses vanilla HTML5, CSS3, and JavaScript with CDN-hosted libraries (Chart.js & Lucide), **no build step or server installation is required**.

### Method 1: Direct File Open (Easiest)
1. Double-click `index.html` or right-click `index.html` and choose **Open with > Google Chrome / Microsoft Edge / Firefox**.
2. The dashboard will load and calculate results immediately.

### Method 2: Local HTTP Server (Python)
If you prefer running via a local server:
```bash
# In this directory:
python -m http.server 8000
```
Then open your browser and navigate to:
```
http://localhost:8000
```

### Method 3: VS Code Live Server
1. Open the project folder in VS Code.
2. Right-click `index.html` and select **"Open with Live Server"**.

---

## 📁 File Structure
```
d:\College\5th SEM\sem5\EVS\Carbon footprint\
├── index.html        # Main application markup (6 sections, modals, tables)
├── styles.css        # Responsive styling, CSS variables, custom controls, print styles
├── app.js            # Calculation engine, Chart.js managers, simulation, DSS engine
└── README.md         # Documentation, methodology, and run instructions
```
