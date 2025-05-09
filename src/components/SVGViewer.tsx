import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { toPng, toJpeg, toSvg } from 'html-to-image';
import { saveAs } from 'file-saver';
import { toast } from 'react-toastify';
import { Copy, Download, Image, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import SampleSVGs from './SampleSVGs';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';


interface SVGViewerProps {
  initialSvg?: string;
  className?: string;
}

// 自定义高亮配置（可选）
const svgHighlight = syntaxHighlighting(defaultHighlightStyle, { fallback: true });

// CodeMirror 扩展
const extensions = [
  xml(),
  oneDark,
  EditorView.lineWrapping,
  svgHighlight,
  EditorView.theme({
    "&": {
      height: "100%", // 设置编辑器的高度为100%
    }
  })
];
/* eslint-disable */ 
const SVGViewer = ({ initialSvg = '', className = '' }: SVGViewerProps) => {
  const [svgCode, setSvgCode] = useState(initialSvg);
  const [fileName, setFileName] = useState('svg-preview');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const wheelTimeoutRef = useRef(null);
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const [previewSvgCode, setPreviewSvgCode] = useState('');

  // 确保 SVG 包含宽度和高度属性
  const ensureSvgDimensions = (svgCode: string): string => {
    if (!svgCode || !isValidSvg(svgCode)) return svgCode;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgCode, 'image/svg+xml');
    const svgElement = doc.querySelector('svg');

    if (!svgElement) return svgCode;

    // 如果没有 width 或 height 属性，并且有 viewBox
    if ((!svgElement.hasAttribute('width') || !svgElement.hasAttribute('height')) && svgElement.hasAttribute('viewBox')) {
      const viewBox = svgElement.getAttribute('viewBox')?.split(' ').map(Number);
      if (viewBox && viewBox.length === 4) {
        const [, , width, height] = viewBox;
        if (!svgElement.hasAttribute('width')) {
          svgElement.setAttribute('width', width.toString());
        }
        if (!svgElement.hasAttribute('height')) {
          svgElement.setAttribute('height', height.toString());
        }
      }
    }

    // 如果仍然没有宽度和高度，设置默认值
    if (!svgElement.hasAttribute('width')) {
      svgElement.setAttribute('width', '300');
    }
    if (!svgElement.hasAttribute('height')) {
      svgElement.setAttribute('height', '300');
    }

    return new XMLSerializer().serializeToString(doc);
  };

  const handleSvgChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setSvgCode(e.target.value);
  };

  const handleFileNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFileName(e.target.value);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Update filename without extension
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    setFileName(nameWithoutExt);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setSvgCode(content);
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (isValidSvg(clipboardText)) {
        setSvgCode(clipboardText);
        toast.success('已从剪贴板导入SVG');
      } else {
        toast.error('剪贴板内容不是有效的SVG');
      }
    } catch (error) {
      console.error('Failed to read from clipboard:', error);
      toast.error('从剪贴板读取失败');
    }
  };

  const exportAsImage = async (format: 'png' | 'jpeg' | 'svg') => {
    if (!svgCode) {
      toast.error('没有SVG代码可导出');
      return;
    }
    
    try {
      // 解析SVG代码以获取尺寸
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgCode, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');
      
      if (!svgElement) {
        toast.error('无效的SVG代码');
        return;
      }
      
      // 获取SVG的原始尺寸
      let width = parseInt(svgElement.getAttribute('width') || '0');
      let height = parseInt(svgElement.getAttribute('height') || '0');
      
      // 如果没有width和height属性，尝试从viewBox获取
      if (!width || !height) {
        const viewBox = svgElement.getAttribute('viewBox')?.split(' ').map(Number);
        if (viewBox && viewBox.length === 4) {
          width = viewBox[2];
          height = viewBox[3];
        }
      }
      
      // 如果仍然没有有效的尺寸，使用默认值
      if (!width || !height) {
        width = 800;
        height = 600;
      }

      // 确保SVG有明确的宽度和高度
      svgElement.setAttribute('width', width.toString());
      svgElement.setAttribute('height', height.toString());
      
      // 将SVG转换为base64编码的数据URL
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
      const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
      
      // 创建Image对象来加载SVG
      const img = document.createElement('img');
      
      // 等待图片加载完成
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = (e) => {
          console.error('Image load error:', e);
          reject(new Error('图片加载失败'));
        };
        img.src = dataUrl;
      });
      
      // 创建canvas来渲染图片
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('无法创建canvas上下文');
      }
      
      // 设置白色背景
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      
      // 绘制SVG
      ctx.drawImage(img, 0, 0, width, height);
      
      // 转换为所需格式并保存
      switch (format) {
        case 'png':
          saveAs(canvas.toDataURL('image/png'), `${fileName}.png`);
          break;
        case 'jpeg':
          saveAs(canvas.toDataURL('image/jpeg', 0.95), `${fileName}.jpg`);
          break;
        case 'svg':
          // 直接保存SVG代码
          const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
          saveAs(blob, `${fileName}.svg`);
          break;
      }
      
      toast.success(`导出为 ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('导出失败，请重试');
    }
  };

  const downloadSvgCode = () => {
    if (!svgCode.trim()) {
      toast.error('没有 SVG 代码可下载');
      return;
    }
    
    const blob = new Blob([svgCode], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${fileName}.svg`);
    toast.success('SVG 代码已下载');
  };

  const copySvgCode = async () => {
    if (!svgCode.trim()) {
      toast.error('没有 SVG 代码可复制');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(svgCode);
      toast.success('SVG 代码已复制到剪贴板');
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('复制到剪贴板失败');
    }
  };

  const handleScaleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setScale(parseFloat(e.target.value));
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.1, 3));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.1, 0.1));
  };

  // Reset position when scale changes
  const resetPosition = () => {
    setPosition({ x: 0, y: 0 });
  };

  // Detect if SVG is valid
  const isValidSvg = (code: string): boolean => {
    return /<svg[^>]*>[\s\S]*<\/svg>/i.test(code);
  };

  const clearSvgCode = () => {
    setSvgCode('');
    toast.info('SVG 内容已清除');
  };

  const handleClear = () => {
    setSvgCode('');
    toast.info('SVG 内容已清除');
  };

  const handleDownload = () => {
    const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'downloaded.svg';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('SVG 已下载');
  };

  const updatePreview = () => {
    if (isValidSvg(svgCode)) {
      setPreviewSvgCode(svgCode);
    } else {
      toast.error('无效的 SVG 代码');
    }
  };

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: svgCode,
      extensions: [
        ...extensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newSvgCode = update.state.doc.toString();
            setSvgCode(newSvgCode);
            setPreviewSvgCode(ensureSvgDimensions(newSvgCode));
          }
        })
      ]
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, []); // 只在组件挂载时运行一次

  // 当外部 svgCode 改变时更新编辑器内容
  useEffect(() => {
    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString();
      if (currentContent !== svgCode) {
        viewRef.current.dispatch({
          changes: { from: 0, to: viewRef.current.state.doc.length, insert: svgCode }
        });
      }
    }
  }, [svgCode]);

  return (
    <div className="w-[1280px] h-full  mx-auto flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
        {/* SVG Input Section */}
        <div className="flex flex-col p-2 h-full">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-lg font-semibold">SVG 代码</h2>
            <div className="flex gap-2">
              <button 
                onClick={handlePasteFromClipboard}
                className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
                从剪贴板导入
              </button>
              <button 
                onClick={clearSvgCode}
                className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                清除
              </button>
              <button 
                onClick={triggerFileInput}
                className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
              >
                <Upload size={16} />
                上传
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".svg" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </div>
          </div>
          <div ref={editorRef} className="w-full h-[calc(100vh-310px)] overflow-auto" />
          
        </div>

        {/* SVG Preview Section */}
        <div className="flex flex-col p-2 ">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-lg font-semibold">预览</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={zoomOut}
                className="p-1 rounded-md hover:bg-gray-200 transition-colors"
                aria-label="Zoom out"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-sm font-mono">{scale.toFixed(1)}倍</span>
              <button
                onClick={zoomIn}
                className="p-1 rounded-md hover:bg-gray-200 transition-colors"
                aria-label="Zoom in"
              >
                <ZoomIn size={18} />
              </button>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => {
                  handleScaleChange(e);
                  resetPosition();
                }}
                className="w-24"
              />
            </div>
          </div>
          <div 
            ref={previewRef}
            className="flex-1 p-4 border rounded-md bg-white flex items-center justify-center overflow-hidden relative h-[400px] min-h-[400px] min-w-[300px]"
          >
            {previewSvgCode ? (
              <div 
                style={{ 
                  transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`, 
                  transformOrigin: 'center',
                  willChange: 'transform',
                  transition: 'none',
                }}
                dangerouslySetInnerHTML={{ __html: previewSvgCode }}
              />
            ) : (
              <div className="text-gray-400 text-center">
                "SVG 预览将在此处显示"
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 justify-between  p-2">
      <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label htmlFor="fileName" className="text-sm font-medium">文件名:</label>
              <input
                id="fileName"
                type="text"
                value={fileName}
                onChange={handleFileNameChange}
                className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">

        <button
          onClick={() => exportAsImage('png')}
          disabled={!svgCode || !isValidSvg(svgCode)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Image size={18} />
          导出为 PNG
        </button>
        <button
          onClick={() => exportAsImage('jpeg')}
          disabled={!svgCode || !isValidSvg(svgCode)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Image size={18} />
          导出为 JPEG
        </button>
        <button
          onClick={downloadSvgCode}
          disabled={!svgCode}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={18} />
          下载 SVG
        </button>
        <button
          onClick={copySvgCode}
          disabled={!svgCode}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Copy size={18} />
          复制 SVG 代码
        </button>
          </div>
      </div>

    </div>
  );
};

export default SVGViewer; 