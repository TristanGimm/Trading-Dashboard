import { init, use } from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import { AriaComponent, GridComponent, TooltipComponent, LegendComponent, GraphicComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

use([BarChart, LineChart, PieChart, ScatterChart, AriaComponent, GridComponent, TooltipComponent, LegendComponent, GraphicComponent, MarkLineComponent, CanvasRenderer]);
export { init };
