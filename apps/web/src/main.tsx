import { createRoot } from 'react-dom/client'
import '@fontsource-variable/dm-sans/wght.css'
import './app/style.css'
import { Bootstrap } from './app/Bootstrap'

createRoot(document.getElementById('root')!).render(<Bootstrap />)
