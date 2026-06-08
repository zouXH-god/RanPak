/**
 * Vue 应用入口
 * 初始化鉴权 Token 后挂载应用
 */
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './index.css'
import './element-theme.css'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { fetchApiToken } from './utils/api/requests.ts'

async function bootstrap() {
    await fetchApiToken()
    createApp(App).use(router).use(ElementPlus, { locale: zhCn }).mount('#app')
}

bootstrap()
