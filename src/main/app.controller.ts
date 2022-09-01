import { Controller, IpcHandle, IpcOn, Window } from 'einf'
import { BrowserWindow, dialog,clipboard,shell } from 'electron'
import { factory, Conf as JsonConf } from 'electron-json-config'
import fse from 'fs-extra'
import { download } from 'electron-dl';


@Controller()
export class AppController {
  private version:String = process.env.VERSION

  private dbConfig: JsonConf
  private uniappWin: BrowserWindow | null = null

  constructor(
    @Window() private mainWin: BrowserWindow,
  ) {
    this.dbConfig = factory()
  }

  /**
   * 打开uniapp调试窗口 或者 重新加载窗口
   * @param config 
   */
  @IpcOn('diygw-open-uniapp')
  public openUniapp(config: any) {
    const data: any = this.dbConfig.get(config.id)
    if (data && data.url) {
      if (!this.uniappWin) {
        this.uniappWin = new BrowserWindow({
          width: config.width || 388,
          height: config.height || 680,
          center: true
        })
        this.uniappWin.on('closed', () => {
          this.uniappWin = null
        })
      }

      let url = data.url
      if (url.indexOf('#') > 0) {
        url = url.substring(0, url.indexOf('#'))
      }
      this.uniappWin.loadURL(url + '#/pages/' + config.page)
      this.uniappWin.setAlwaysOnTop(true, 'floating')
    } else {
      dialog.showMessageBox({
        type: 'warning',
        title: '警告',
        buttons: ['确定'],
        message: '请先配置本地调试地址',
        noLink: true
      })
    }
  }

  /**
   * 切换页面刷新页面
   */
  @IpcOn('diygw-change-uniapp')
  public changeUniapp(config: any) {
    const data: any = this.dbConfig.get(config.id)
    if (data && data.url && this.uniappWin) {
      const projectPath = data['uniapp'] + '/pages/'
      const pageFile = projectPath + config.page + '.vue'
      if (!fse.existsSync(pageFile)) {
        //给渲染进程发送消息
        this.mainWin.webContents.send('message', { cmd: 'no-file-exist' })
        return
      }
      let url = data.url
      if (url.indexOf('#') > 0) {
        url = url.substring(0, url.indexOf('#'))
      }
      this.uniappWin.loadURL(url + '#/pages/' + config.page)
      this.uniappWin.setAlwaysOnTop(true, 'floating')
    }
  }

  /**
   * 获取配置
   */
  @IpcHandle('diygw-get-config')
  public getConfig(id: any) {
    return this.dbConfig.get(id)
  }

  /**
  * 设置配置
  */
  @IpcHandle('diygw-set-config')
  public setConfig(config: any) {
    this.dbConfig.set(config.id, config)
    return true
  }

  /**
   * 获取当前源码配置的目录
   */
  @IpcHandle('diygw-select-dir')
  public selectDir(config: any) {
    const filePaths = dialog.showOpenDialogSync({
      properties: ['openDirectory', 'createDirectory']
    })
    if (!filePaths) {
      return null
    }
    //判断是否移动端配置,如果非移动端的都直接返回
    if (config.mobile) {
      if (config.type === 'uniapp') {
        const pagefile = filePaths[0] + '/pages.json'
        if (fse.existsSync(pagefile)) {
          return filePaths[0]
        } else {
          return 'error'
        }
      } else if (config.type === 'h5') {
        return filePaths[0]
      } else {
        const pagefile = filePaths[0] + '/app.json'
        if (fse.existsSync(pagefile)) {
          return filePaths[0]
        } else {
          return 'error'
        }
      }
    }else if (config.type === 'eleadmin'||config.type === 'eleoption') {
      //前后分离项目
      const pagefile = filePaths[0] + '/package.json'
      if (fse.existsSync(pagefile)) {
        return filePaths[0]
      } else {
        return 'error'
      }
    }else if (config.type === 'adminh5') {
      //静态后台h5页面
      const pagefile = filePaths[0] + '/siteinfo.js'
      if (fse.existsSync(pagefile)) {
        return filePaths[0]
      } else {
        return 'error'
      }
    }else {
      return filePaths[0]
    }
  }

  /**
   * 下载文件
   */
  @IpcOn('diygw-down-file')
  public async downloadFile({ url }: any) {
    const win: any = BrowserWindow.getFocusedWindow();
    await download(win, url, {
      saveAs: true
    });
  }

  /**
   * 获取当前源码配置的目录
   */
  @IpcHandle('diygw-save-code')
  public async saveCode(config: any) {
    const data: any = this.dbConfig.get(config.id)
    //判断是否移动端配置,如果非移动端的都直接返回
    if (config.mobile) {
      if (config.code.type === 'uniapp') {
        const projectPath = data[config.code.type] + '/pages/'
        const pageFile = projectPath + config.data.path + '.vue'
        //保存页面代码
        fse.outputFileSync(pageFile, config['code']['htmlValue'])
        //获取页面配置代码
        const pageConfig = data[config.code.type] + '/pages.json'
        const configData = fse.readJSONSync(pageConfig)
        const index = configData.pages.findIndex((item: any) => {
          return item.path === 'pages/' + config.data.path
        })
        if (index >= 0) {
          configData.pages.splice(
            index,
            1,
            JSON.parse(config['code']['jsonValue'])
          )
        } else {
          configData.pages.push(JSON.parse(config['code']['jsonValue']))
        }
        fse.outputFileSync(pageConfig, JSON.stringify(configData, undefined, 4))
      } else if (config.code.type === 'h5') {
        const projectPath = data[config.code.type]
        const pageFile = projectPath + config.data.path + '.html'
        fse.outputFileSync(pageFile, config['code']['htmlValue'])
      }  else {
        const projectPath = data[config.code.type] + '/pages/'
        const htmlTypes = <any>{
          weixin: 'wxml',
          alipay: 'axml',
          dingtalk: 'axml',
          finclip: 'fxml',
          qq: 'qml',
          baidu: 'swan',
          bytedance: 'ttml'
        }
        const cssTypes = <any>{
          weixin: 'wxss',
          alipay: 'acss',
          dingtalk: 'acss',
          finclip: 'ftss',
          qq: 'qss',
          baidu: 'css',
          bytedance: 'ttss'
        }
        const htmlPageFile =
          projectPath + config.data.path + '.' + htmlTypes[config.code.type]
        fse.outputFileSync(htmlPageFile, config['code']['htmlValue'])

        const cssPageFile =
          projectPath + config.data.path + '.' + cssTypes[config.code.type]
        fse.outputFileSync(cssPageFile, config['code']['cssValue'])

        const jsPageFile = projectPath + config.data.path + '.js'
        fse.outputFileSync(jsPageFile, config['code']['jsValue'])

        const jsonPageFile = projectPath + config.data.path + '.json'
        fse.outputFileSync(jsonPageFile, config['code']['jsonValue'])

        //设置新页面配置代码
        const pageConfig = data[config.code.type] + '/app.json'
        const configData = fse.readJSONSync(pageConfig)
        const index = configData.pages.findIndex((item: any) => {
          return item === 'pages/' + config.data.path
        })
        if (index >= 0) {
          configData.pages.splice(index, 1, 'pages/' + config.data.path)
        } else {
          configData.pages.push('pages/' + config.data.path)
        }
        fse.outputFileSync(pageConfig, JSON.stringify(configData, undefined, 4))
      }
    }else if (config.code.type === 'eleadmin'||config.code.type === 'eleoption') {
      const projectPath = data[config.code.type]
      //生成vue文件
      const pageFile = projectPath + "/src/views/"+config.data.path + '.vue'
      fse.outputFileSync(pageFile, config['code']['htmlValue'])

       //替换页面路由
       const pageConfig = data[config.code.type] + '/src/router/frontRoute.ts'
       fse.writeFileSync(pageConfig,config['code']['jsValue'])

       /*
       const frontRoute = fse.readFileSync(pageConfig).toString()
       const jsValue = config['code']['jsValue'];
       增加更新路由
       //获取当前页面路径
       const path = "//path:/"
       const findPath = jsValue.substring(jsValue.indexOf(path)+path.length,jsValue.indexOf("{")).trim();
       //判断路径是否已存在
       if(frontRoute.indexOf("'"+findPath+"'")>0){
            //插入开始
            const  search = "export const frontRoutes={";
            if(frontRoute.indexOf(search)>=0){
                const startContent = frontRoute.substring(0,frontRoute.indexOf(search));
                const endContent = frontRoute.substring(frontRoute.indexOf(search)+search.length);
                const result = startContent + "\rroutes[0].children?.push("+config['code']['jsValue'].substring(config['code']['jsValue'].indexOf("{"))+")\r" + search + endContent
                fse.writeFileSync(pageConfig,result)
            }
       }
       */

    }else if (config.code.type === 'adminh5') {
      const projectPath = data[config.code.type]
      //保存HTML文件
      const pageFile = projectPath + "/"+config.data.path + '.html'
      fse.outputFileSync(pageFile, config['code']['htmlValue'])

      //保存配置siteinfojs
      const siteinfoFile = projectPath +  '/siteinfo.js'
      fse.outputFileSync(siteinfoFile, config['code']['jsonValue'])

    }
  }

   /**
  * 设置配置
  */
  @IpcHandle('diygw-get-version')
  public getVersion(config: any) {
    return this.version
  }

  /**
  * 复制内容
  */
  @IpcHandle('diygw-copy')
  public copyText(data: any) {
    if(data.type=='html'){
      clipboard.writeHTML(data.text)
    }else{
      clipboard.writeText(data.text)
    }
  }

  /**
  * 下载地址
  */
   @IpcHandle('diygw-down')
   public downLink(data: any) {
      shell.openExternal(data.text)
   }
 
}
