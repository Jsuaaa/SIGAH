// Registro de Chart.js para vue-chartjs. Importar este módulo una vez antes de
// usar los componentes <Bar>, <Pie>, <Line> (registra controllers/elements/scales).
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)
