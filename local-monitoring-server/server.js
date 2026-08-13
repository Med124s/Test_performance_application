const express = require('express')
const cors = require('cors')
const si = require('systeminformation')

const app = express()
app.use(cors())

const PORT = process.env.PORT || 5000

function classifyHealth(cpu, ram, disk) {
  if (cpu >= 90 || ram >= 90 || disk >= 95) return 'Critical'
  if (cpu >= 75 || ram >= 75 || disk >= 85) return 'Degraded'
  return 'Healthy'
}

app.get('/server-metrics', async (req, res) => {
  try {
    const [load, mem, fsSize, netStats] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
    ])

    const cpu = Math.round(load.currentLoad)
    const ram = Math.round((mem.active / mem.total) * 100)

    const primaryDisk = fsSize.reduce((largest, d) => (d.size > (largest ? largest.size : 0) ? d : largest), null)
    const disk = primaryDisk ? Math.round(primaryDisk.use) : 0

    const bytesPerSec = netStats.reduce((sum, n) => sum + (n.rx_sec || 0) + (n.tx_sec || 0), 0)
    const network = Math.round((bytesPerSec * 8) / 1_000_000)

    res.json({
      cpu,
      ram,
      disk,
      network,
      health: classifyHealth(cpu, ram, disk),
      capturedAt: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: 'Impossible de lire les ressources du PC', details: String(err) })
  }
})

app.listen(PORT, () => {
  console.log(`Local Test Server monitoring API — http://localhost:${PORT}/server-metrics`)
})
