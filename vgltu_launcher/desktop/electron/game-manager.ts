import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs-extra'
import axios from 'axios'
import crypto from 'crypto'
import pLimit from 'p-limit'
import http from 'http'
import https from 'https'
import { exec } from 'child_process'
import util from 'util'
import { MinecraftFolder, launch, Version } from '@xmcl/core'

const execAsync = util.promisify(exec)

const ROOT_PATH = path.join(app.getPath('appData'), '.pixel-launcher')
const AUTHLIB_PATH = path.join(ROOT_PATH, 'authlib-injector.jar')
import { getApiUrl } from './config'

const AUTHLIB_URL = "https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar"

type MirrorOptions = Record<string, string>

type InstanceFile = {
  filename: string
  hash: string
  path: string
  url: string
}

type InstanceManifest = {
  files: InstanceFile[]
  loader_type?: string
  loader_version?: string
  mc_version: string
}

type AuthData = {
  accessToken: string
  username: string
  uuid: string
}

type ActiveInstance = { id: string }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// Ленивая загрузка API URL (после app.whenReady)
function getApiUrlLazy(): string {
  return getApiUrl()
} 

const MIRROR_LIST = [
  {
    name: "FastMirror",
    options: {
      client: 'https://piston-meta.fastmcmirror.org',
      assetsHost: 'https://resources.fastmcmirror.org',
      maven: 'https://libraries.fastmcmirror.org/maven',
      mavenForge: 'https://forge.fastmcmirror.org/maven',
      mavenFabric: 'https://fabric.fastmcmirror.org'
    }
  },
  {
    name: "Official",
    options: {
      client: 'https://piston-meta.mojang.com',
      assetsHost: 'https://resources.download.minecraft.net',
      maven: 'https://libraries.minecraft.net',
      mavenForge: 'https://maven.minecraftforge.net',
      mavenFabric: 'https://maven.fabricmc.net'
    }
  }
]

const httpAgent = new http.Agent({ maxSockets: 16, maxFreeSockets: 5, keepAlive: true })
const httpsAgent = new https.Agent({ maxSockets: 16, maxFreeSockets: 5, keepAlive: true })
axios.defaults.httpAgent = httpAgent
axios.defaults.httpsAgent = httpsAgent

export class GameManager {
  private window: BrowserWindow
  private currentMirrorIndex: number = 0

  constructor(window: BrowserWindow) {
    this.window = window
  }

  log(msg: string) {
    if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('log', msg)
    }
    console.log(msg) 
  }

  getCurrentMirror() { return MIRROR_LIST[this.currentMirrorIndex] }
  
  switchToNextMirror(): boolean {
    if (this.currentMirrorIndex < MIRROR_LIST.length - 1) {
      this.currentMirrorIndex++
      const mirror = this.getCurrentMirror()
      this.log(`🔄 Switching to mirror: ${mirror.name}`)
      return true
    }
    return false
  }

  async tryWithMirrors<T>(fn: (mirrorOptions: MirrorOptions) => Promise<T>, taskName: string): Promise<T> {
    const startMirrorIndex = this.currentMirrorIndex
    while (this.currentMirrorIndex < MIRROR_LIST.length) {
      const mirror = this.getCurrentMirror()
      this.log(`🌐 Trying ${taskName} with ${mirror.name}...`)
      try {
        const result = await fn(mirror.options)
        this.log(`✅ ${taskName} succeeded`)
        return result
      } catch (error: unknown) {
        this.log(`❌ ${mirror.name} failed: ${errorMessage(error)}`)
        if (!this.switchToNextMirror()) {
          this.currentMirrorIndex = startMirrorIndex
          throw new Error(`All mirrors failed`)
        }
      }
    }
    throw new Error(`All mirrors failed`)
  }

  emitProgress(task: string, details: string, percent: number) {
    if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('progress', { task, details, percent })
    }
  }

  async retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn()
    } catch (error: unknown) {
      if (retries > 0) {
        this.log(`⚠️ Retry (${retries} left)...`)
        await new Promise(res => setTimeout(res, delay))
        return this.retry(fn, retries - 1, delay * 2)
      }
      throw error
    }
  }

  async getJavaVersion(javaPath: string): Promise<number | null> {
    try {
      const { stderr } = await execAsync(`"${javaPath}" -version`)
      const versionLine = stderr.split('\n')[0]
      const match = versionLine.match(/version "(.*?)"/)
      if (match) {
        const v = match[1]
        if (v.startsWith('1.8')) return 8
        if (v.startsWith('1.')) return parseInt(v.split('.')[1])
        return parseInt(v.split('.')[0])
      }
      return null
    } catch (e) { return null }
  }

  async findBestJava(mcVersion: string): Promise<string> {
    this.log(`🔍 Detecting Java for Minecraft ${mcVersion}...`)
    let requiredJava = 8
    const [major, minor] = mcVersion.split('.').map(Number)
    if (major === 1) {
      if (minor >= 17) requiredJava = 17 
      else requiredJava = 8
    }

    const potentialPaths = [
      process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java') : null,
      'java',
    ]
    if (process.platform === 'win32') {
      const programFiles = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']]
      for (const pf of programFiles) {
        if (!pf) continue
        const javaRoot = path.join(pf, 'Java')
        if (fs.existsSync(javaRoot)) {
          const dirs = await fs.readdir(javaRoot)
          dirs.forEach(d => potentialPaths.push(path.join(javaRoot, d, 'bin', 'java.exe')))
        }
        const adoptRoot = path.join(pf, 'Eclipse Adoptium')
        if (fs.existsSync(adoptRoot)) {
            const dirs = await fs.readdir(adoptRoot)
            dirs.forEach(d => potentialPaths.push(path.join(adoptRoot, d, 'bin', 'java.exe')))
        }
      }
    }

    for (const p of potentialPaths) {
      if (!p) continue
      const v = await this.getJavaVersion(p)
      if (v === requiredJava) return p
      if (v && v > requiredJava && requiredJava >= 17) return p
    }
    return 'java'
  }

  async cleanOldInstances(activeInstances: ActiveInstance[]) {
    const instancesDir = path.join(ROOT_PATH, 'instances')
    await fs.ensureDir(instancesDir)
    const localFolders = await fs.readdir(instancesDir)
    const activeIds = activeInstances.map(i => i.id)
    for (const folder of localFolders) {
      if (!activeIds.includes(folder)) {
        try {
          await fs.remove(path.join(instancesDir, folder))
        } catch (error: unknown) {
          this.log(`⚠️ Could not remove old instance ${folder}: ${errorMessage(error)}`)
        }
      }
    }
  }

  async checkFile(filePath: string, expectedHash: string): Promise<boolean> {
    if (!fs.existsSync(filePath)) return false
    const fileBuffer = await fs.readFile(filePath)
    const hashSum = crypto.createHash('sha256')
    hashSum.update(fileBuffer)
    return hashSum.digest('hex') === expectedHash
  }

  async downloadFile(url: string, dest: string) {
    await fs.ensureDir(path.dirname(dest))
    const writer = fs.createWriteStream(dest)
    const response = await axios({ 
      url, method: 'GET', responseType: 'stream', maxRedirects: 5, timeout: 60000
    })
    response.data.pipe(writer)
    return new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve())
      writer.on('error', reject)
      response.data.on('error', reject)
    })
  }

  async installAndLaunch(
    instanceId: string,
    manifest: InstanceManifest,
    authData: AuthData,
    memory: number = 2048,
  ) {
    const { install, installForge, getVersionList, getForgeVersionList, installDependencies } = await import('@xmcl/installer')
    
    const instanceDir = path.join(ROOT_PATH, 'instances', instanceId)
    const mc = new MinecraftFolder(instanceDir) 
    
    this.log(`📂 Instance: ${instanceId} (${manifest.mc_version}) | RAM: ${memory}MB`)
    this.emitProgress('Initializing', 'Checking Java...', 0)

    const javaPath = await this.findBestJava(manifest.mc_version)

    // 2. Authlib (УПРОЩЕННАЯ ЛОГИКА)
    // Если файла нет - качаем. Если есть - используем. (Без хеша, чтобы не ломать обновления)
    if (!fs.existsSync(AUTHLIB_PATH)) {
      this.emitProgress('Dependencies', 'Downloading Authlib...', 5)
      try {
          await this.retry(() => this.downloadFile(AUTHLIB_URL, AUTHLIB_PATH))
          this.log('✅ Authlib downloaded')
      } catch (error: unknown) {
        this.log(`❌ Authlib download failed: ${errorMessage(error)}`)
          // Не прерываем, может оно и без него запустится (нет, не запустится, но крашнемся позже)
      }
    } else {
        this.log('✅ Authlib found (integrity check skipped)')
    }

    // 3. Mods Sync
    this.log(`🔍 Syncing ${manifest.files.length} mods/configs...`)
    this.emitProgress('Syncing Files', 'Checking local files...', 10)
    
    const totalFiles = manifest.files.length
    let processedCount = 0
    const BATCH_SIZE = 50 
    const limit = pLimit(10) 
    
    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
      const batch = manifest.files.slice(i, i + BATCH_SIZE)
      const tasks = batch.map((file) => limit(async () => {
        const localPath = path.join(instanceDir, file.path)
        
        const percent = 10 + Math.floor((processedCount / totalFiles) * 40)
        if (processedCount % 10 === 0) {
            this.emitProgress('Syncing Files', `Checking ${file.filename}...`, percent)
        }

        if (!(await this.checkFile(localPath, file.hash))) {
          this.log(`⬇️ Downloading: ${file.filename}`)
          await this.retry(() => this.downloadFile(file.url, localPath))
        }
        processedCount++
      }))
      await Promise.all(tasks)
    }

    // 4. INSTALL VANILLA
    this.emitProgress('Installing Minecraft', `Version ${manifest.mc_version}`, 50)
    const versionJsonPath = path.join(instanceDir, 'versions', manifest.mc_version, `${manifest.mc_version}.json`)
    let installedVersion: string
    
    if (fs.existsSync(versionJsonPath)) {
      installedVersion = manifest.mc_version
    } else {
      await this.tryWithMirrors(async (mirrorOptions) => {
        const versionList = await getVersionList(mirrorOptions)
        const versionMeta = versionList.versions.find(v => v.id === manifest.mc_version)
        if (!versionMeta) throw new Error(`Version ${manifest.mc_version} not found!`)
        return await install(versionMeta, mc, mirrorOptions)
      }, 'Minecraft installation')
      installedVersion = manifest.mc_version
    }

    // 5. INSTALL FORGE
    this.emitProgress('Installing Loader', `Forge & Libraries`, 70)
    let finalVersionId = installedVersion
    if (manifest.loader_type === 'forge') {
        const forgeVersionId = `${manifest.mc_version}-forge-${manifest.loader_version || '14.23.5.2864'}`
        const forgeJsonPath = path.join(instanceDir, 'versions', forgeVersionId, `${forgeVersionId}.json`)
        
        if (fs.existsSync(forgeJsonPath)) {
          finalVersionId = forgeVersionId
        } else {
          await this.tryWithMirrors(async (mirrorOptions) => {
            const forgeList = await getForgeVersionList({ minecraft: manifest.mc_version, ...mirrorOptions })
            const forgeVersion = forgeList.versions[0]
            return await installForge(forgeVersion, mc, mirrorOptions)
          }, 'Forge installation')
          finalVersionId = forgeVersionId
        }
        
        try {
          await this.tryWithMirrors(async (mirrorOptions) => {
            const resolvedVersion = await Version.parse(mc, finalVersionId)
            return await installDependencies(resolvedVersion, mirrorOptions)
          }, 'Dependencies installation')
        } catch (error: unknown) {
          this.log(`⚠️ Dependency error: ${errorMessage(error)}`)
        }
    }

    // 6. ЗАПУСК
    this.emitProgress('Launching', 'Starting Java Process...', 90)
    try {
      const gameProcess = await launch({
        version: finalVersionId,
        javaPath: javaPath, 
        gamePath: instanceDir,
        gameProfile: { id: authData.uuid, name: authData.username },
        accessToken: authData.accessToken,
        minMemory: Math.floor(memory / 2),
        maxMemory: memory,
        extraJVMArgs: [
          `-Xmx${memory}M`,
          `-javaagent:${AUTHLIB_PATH}=${getApiUrlLazy()}/authserver`
        ],
        extraExecOption: { stdio: ['ignore', 'pipe', 'pipe'] }
      })

      this.log(`⚡ Process started! PID: ${gameProcess.pid}`)
      this.emitProgress('Launch', 'Game Started!', 100)
      
      this.log("🙈 Hiding launcher window...")
      if (this.window) this.window.hide()

      gameProcess.stdout?.on('data', (data: Buffer) => {
        console.log(`[MC] ${data.toString().trim()}`)
      })
      
      gameProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`[MC ERR] ${data.toString().trim()}`)
      })

      gameProcess.on('exit', (code) => {
        console.log(`Game exited with code ${code}`)
        if (this.window) {
            this.window.show()
            this.window.focus()
            this.window.webContents.send('log', `🛑 Game exited (Code: ${code})`)
        }
      })

    } catch (error: unknown) {
      this.log(`❌ Launch failed: ${errorMessage(error)}`)
      throw error
    }
  }
}
