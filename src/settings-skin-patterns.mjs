/** Original, code-native abstract wallpaper recipes. No third-party image assets. */
export const skinPatterns={
 mist:{name:'雾紫',palette:'lavender',paint:'radial-gradient(ellipse at 18% 15%,#d8c9f5,transparent 54%),radial-gradient(ellipse at 88% 88%,#a994d1,transparent 58%),linear-gradient(135deg,#f6edfa,#c9bcdf)'},
 tide:{name:'静海',palette:'blue',paint:'radial-gradient(ellipse at 15% 85%,#8cb9d1,transparent 65%),radial-gradient(ellipse at 80% 10%,#d8ebf4,transparent 50%),linear-gradient(145deg,#aec1de,#618ba7)'},
 leaf:{name:'竹影',palette:'sage',paint:'linear-gradient(125deg,transparent 25%,#b2c9ba 25.1%,#dce6d9 48%,transparent 48.1%),linear-gradient(150deg,#edf0dc,#88a997)'},
 dune:{name:'暖沙',palette:'lavender',paint:'radial-gradient(ellipse at 16% 110%,#bc998b 30%,transparent 30.2%),radial-gradient(ellipse at 70% 110%,#e0baab 48%,transparent 48.2%),linear-gradient(135deg,#f5eadb,#d2baae)'},
 aurora:{name:'极光',palette:'sage',paint:'radial-gradient(ellipse at 70% 5%,#a0bba6,transparent 55%),radial-gradient(ellipse at 20% 80%,#9ba9c6,transparent 60%),linear-gradient(130deg,#172b30,#638d8c)'},
 midnight:{name:'夜潮',palette:'blue',paint:'radial-gradient(ellipse at 10% 90%,#555c90,transparent 60%),radial-gradient(ellipse at 90% 20%,#536f88,transparent 56%),linear-gradient(120deg,#171f36,#253b51)'},
}
export function patternPaint(id){return skinPatterns[id]?.paint??''}
