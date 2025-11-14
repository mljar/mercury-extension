import uuid
import json
import pandas as pd
from IPython.display import HTML

def Table(df: pd.DataFrame):
    grid_id = f"aggrid_{uuid.uuid4().hex}"

    data = df.to_dict(orient="records")
    columns = [{"field": str(c)} for c in df.columns]

    html = f"""
    <style>
      /* hide default AG Grid sort icons */
      #{grid_id} .ag-header-icon,
      #{grid_id} .ag-icon-asc,
      #{grid_id} .ag-icon-desc,
      #{grid_id} .ag-icon-sort-ascending,
      #{grid_id} .ag-icon-sort-descending {{
        display: none !important;
      }}

      /* custom sort arrows */
      #{grid_id} .ag-header-cell-label::after {{
        content: "";
        margin-left: 4px;
        font-size: 0.7em;
      }}
      #{grid_id} .ag-header-cell-sorted-asc .ag-header-cell-label::after {{
        content: "▲";
      }}
      #{grid_id} .ag-header-cell-sorted-desc .ag-header-cell-label::after {{
        content: "▼";
      }}
    </style>

    <!-- table container -->
    <div id="{grid_id}" class="ag-theme-balham" style="width:100%;"></div>

    <script>
    (function() {{

      const SCRIPT_URL =
        "https://cdn.jsdelivr.net/npm/ag-grid-community@29.3.4/dist/ag-grid-community.min.js";

      document.querySelectorAll('script[src*="ag-grid-community"]').forEach(el => el.remove());

      function ensureScript(src) {{
        return new Promise((resolve, reject) => {{
          const existing = document.querySelector(`script[src="${{src}}"]`);
          if (existing && window.agGrid && window.agGrid.Grid) {{
            resolve();
            return;
          }}
          const s = existing || document.createElement("script");
          s.src = src;
          s.async = true;
          s.onload = resolve;
          s.onerror = reject;
          if (!existing) document.head.appendChild(s);
        }});
      }}

      (async () => {{
        await ensureScript(SCRIPT_URL);

        const gridOptions = {{
          columnDefs: {json.dumps(columns)},
          rowData: {json.dumps(data)},
          animateRows: true,
          rowSelection: "multiple",
          domLayout: "autoHeight",
          suppressSizeToFit: false,

          defaultColDef: {{
            sortable: true,
            resizable: true
          }}
        }};

        const gridDiv = document.getElementById("{grid_id}");
        const grid = new window.agGrid.Grid(gridDiv, gridOptions);

        requestAnimationFrame(() => {{
          gridOptions.api.sizeColumnsToFit();
        }});

      }})();
    }})();
    </script>
    """

    return HTML(html)
