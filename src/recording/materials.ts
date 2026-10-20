import type {MaterialSnapshot} from './types'
export interface ReadingMaterial extends MaterialSnapshot {estimatedSeconds:number;paragraphs:string[]}
export const READING_MATERIALS:ReadingMaterial[]=[
  {
    "id": "after-rain-v1",
    "version": 1,
    "title": "雨后的街道",
    "source": "原创短文",
    "estimatedSeconds": 45,
    "paragraphs": [
      "傍晚，雨渐渐停了。我推开窗，看见楼下的小路被洗得干干净净。路边的树叶上挂着水珠，远处传来几声清脆的鸟鸣。",
      "我决定出去走一走。街角的面包店还亮着灯，店主正把刚出炉的面包放进篮子。有人撑着伞匆匆走过，也有人停下来，和熟悉的邻居聊上几句。",
      "回家的时候，天空已经放晴。晚风吹过，带来一点青草的味道。我放慢脚步，想把这个平常又安静的傍晚记得久一些。"
    ]
  },
  {
    "id": "morning-park-v1",
    "version": 1,
    "title": "清晨的公园",
    "source": "原创短文",
    "estimatedSeconds": 45,
    "paragraphs": [
      "清晨，我沿着熟悉的小路走进公园。草地上的露水还没有干，几只小鸟正在树枝间跳动。湖边有人慢慢散步，也有人坐在长椅上，安静地看着水面。",
      "走到石桥旁，我看见一位老人正在整理相机。他说，今天的光线很好，想拍下柳树在水中的倒影。我顺着他指的方向望去，微风吹来，原本清楚的影子轻轻散开，又渐渐聚拢。",
      "回去的路上，公园开始热闹起来。孩子的笑声从身后传来，门口的小店也打开了窗。我买了一份早餐，带着清新的空气和一点好心情，开始了平常的一天。"
    ]
  },
  {
    "id": "small-event-v1",
    "version": 1,
    "title": "一件小事",
    "source": "原创短文",
    "estimatedSeconds": 45,
    "paragraphs": [
      "周末整理书架的时候，我在一本旧书里发现了一张车票。上面的字已经有些模糊，我却一下想起了那次出门旅行的情景。那天出发得很早，车站里的人不多，窗外的天色才刚刚亮起来。",
      "我把车票放在桌上，继续翻看那本书。书页间还有几处铅笔留下的记号，有的句子当时很喜欢，现在读来又有了不同的感受。我忽然觉得，留下这些小东西，也是一种保存记忆的方法。",
      "整理结束后，我没有扔掉那张车票，而是把它夹回了原来的位置。也许过一段时间，再次打开这本书，我还会想起今天这个安静的下午。"
    ]
  }
]
export const SPEAKING_PROMPTS=['讲讲今天发生的一件事','介绍一个你熟悉的地方','分享最近喜欢的一本书或一部电影']
