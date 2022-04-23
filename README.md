# WebstaticSpineExtractor  
Extract spine atlas &amp; json &amp; images from genshin web activity pages in one click!  
一键从原神网页活动中提取spine模型及相关图片素材。

### 原理：
原神网页活动的构建配置、工具链和引擎都特别固定，都是webpack entrance在html里，其他数据在两个js里：  
 - app.js是dom ui  
 - vendors.js是库和3d部分

那么只需要
 - 阻止webpack初始化，活动页面就不会正常运行
 - 做一个假的webpack运行环境，用来接收这些模块，得到所有模块的列表
 - 在vendor里搜索所有module，用tostring暴力搜索spine的特征
 - 找到那个3d的组件
 - 由于数据定义在组件内，根本不会暴露出来，所以得用点奇怪的方法去提取他
 - 可以看出这个组件本身也是被webpack编译过一遍的，里面有一个独立的webpack_require
 - 既然是被webpack编译的，考虑到webpack会对每个module做__esModule的处理，那么就把Object.defineProperty给劫持掉，就能拿到这个组件内部的每个子模块列表
 - 暴力遍历子模块，查找符合spine数据源定义特征的模块
 - 把找到的所有模块合并
 - 下载所有的图片
 - 打包压缩  
 
 就能实现自动提取素材了。
 
 本项目仅为对网页活动游戏的项目结构学习的副产品，不对提取后的数据的用途负责。
