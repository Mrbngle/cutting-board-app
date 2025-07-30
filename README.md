# Plywood Cutting Optimizer  plywood cutting optimization web app ️

A web application that calculates efficient cutting patterns for plywood and other sheet materials to minimize waste. This tool is designed for woodworkers, DIY enthusiasts, and anyone looking to optimize their use of sheet goods.

---

## 📋 Project Overview

This application provides a comprehensive suite of tools to define stock boards, input required pieces, and set precise cutting parameters. It then uses a guillotine-based packing algorithm to generate an optimized layout, which can be inspected in both 2D and interactive 3D. The entire project state can be saved, loaded, and persisted in the browser, making it a powerful and practical tool for any cutting project.

---

## ✨ Key Features

* **Board & Piece Management:**
    * Define custom board dimensions (width, length, thickness).
    * Switch seamlessly between **Metric** (mm) and **Imperial** (inches) units.
    * Add an unlimited number of required pieces with dimensions, quantity, name, priority, and **grain direction** constraints.
    * **CSV Import** for quickly adding large cut lists from a spreadsheet.
* **Advanced Cutting Parameters:**
    * Set **saw blade thickness (kerf)** for precise calculations.
    * Define **edge trim** margins for cleaning up stock board edges.
    * Specify a minimum size for usable scrap to be saved.
* **Powerful Optimization:**
    * Uses a **Guillotine cutting algorithm** with a Best Short Side Fit (BSSF) and Split Longer Leftover Axis (SLLA) heuristic to find an efficient layout.
    * Calculates the number of boards required, total waste percentage, and processing time.
* **Interactive Visualization:**
    * Clean **2D SVG visualization** of the layout on each board, with distinct colors for pieces and dashed outlines for usable scrap.
    * Fully interactive **3D WebGL visualization** using Three.js, allowing you to rotate, pan, and zoom the layout.
    * Individual piece borders and board-toggling UI for clear inspection of complex 3D layouts.
* **Project & Data Management:**
    * **Automatic Persistence:** Your entire setup (board, pieces, settings) is automatically saved to `localStorage` in your browser. Just reopen the tab and continue where you left off.
    * **JSON Project Export/Import:** Save a complete project to a `.json` file for backup or sharing, and import projects to instantly load a saved state.
    * **SVG Export:** Download the 2D cutting plan for any board as a self-contained, printable `.svg` file.

---

## 🛠️ Technical Stack

* **Framework:** [SvelteKit](https://kit.svelte.dev/)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Styling:** [SCSS](https://sass-lang.com/) (Externalized from components)
* **3D Visualization:** [Three.js](https://threejs.org/)
* **CSV Parsing:** [Papaparse](https://www.papaparse.com/)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **Runtime:** [Node.js](https://nodejs.org/) with NPM

---

## 🚀 Getting Started

Follow these instructions to get a local copy of the project up and running for development.

### Prerequisites

You will need [Node.js](https://nodejs.org/) (version 18.x or higher) and the `npm` package manager installed on your machine.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
    cd your-repo-name
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

4.  Open your browser and navigate to `http://localhost:5173` (or the address shown in your terminal).

---

## 📖 How to Use

1.  **Configure Board:** Start by setting the dimensions of your stock board material in Section 1. You can switch between `mm` and `inches`.
2.  **Define Pieces:** In Section 2, add the pieces you need to cut. You can add them one by one using the form or import a complete list using the "Import Pieces from CSV" button.
3.  **Set Parameters:** In Section 3, adjust cutting parameters like the saw kerf (blade thickness).
4.  **Optimize:** Click the "Run Cutting Optimization" button in Section 4.
5.  **Review Results:** Analyze the summary card showing boards used and waste percentage.
6.  **Visualize:** Inspect the generated layout using the **2D View** for a clear, printable plan or the **3D View** for an interactive inspection.
7.  **Export:**
    * Click "Export SVG" within the 2D view to download the plan for a specific board.
    * Use the "Export Project" button at the top to save your entire configuration as a `.json` file.