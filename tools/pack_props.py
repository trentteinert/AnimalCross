from PIL import Image
import json,glob
IMG=glob.glob('/private/tmp/claude-501/*/40fa22a6-9c88-4b19-a24d-2de13cb11e81/images/')[0]
im=Image.open(IMG+'11.webp').convert('RGBA'); S=5.875
lines=json.load(open('/tmp/lines.json'))
def native(c):
    w=max(1,round(c.width/S)); h=max(1,round(c.height/S)); out=Image.new('RGBA',(w,h),(0,0,0,0)); px=c.load(); o=out.load()
    for y in range(h):
        for x in range(w):
            sx=min(c.width-1,int((x+.5)*c.width/w)); sy=min(c.height-1,int((y+.5)*c.height/h)); p=px[sx,sy]
            if p[3]>110: o[x,y]=(p[0],p[1],p[2],255)
    return out
def union(cs): return (min(c[0] for c in cs),min(c[1] for c in cs),max(c[2] for c in cs),max(c[3] for c in cs))
L1,L3,L4,L5=lines[1],lines[3],lines[4],lines[5]
L4m=[union([L4[0],L4[1]]),union([L4[2],L4[3]])]+L4[4:]
spec=[]
for n,c in zip(['pine_a','pine_b','tree_red','tree_yellow','tree_orange'],L1): spec.append((n,c))
for n,c in zip(['rock_s','rock_m','rock_l','rock_moss','bush_redflower','bush_yellow','bush_red','bush_lavender','log','stump','bench','lamp'],L3): spec.append((n,c))
for n,c in zip(['flower_a','flower_b','flower_tall','cattails','lily_1','lily_2','lily_3','lily_flower','mush_tan','mush_red','mush_tan2','mush_red2'],L4m): spec.append((n,c))
for n,c in zip(['fl_white','fl_white2','fl_yellow','fl_pink','fl_pink2','fl_purple','fl_lav','weed_red','weed_red2','grass_clump','fl_blue','fl_blue2'],L5): spec.append((n,c))
sprites=[]
for n,c in spec:
    b=(max(0,c[0]),max(0,c[1]),min(im.width,c[2]),min(im.height,c[3])); s=native(im.crop(b)); bb=s.getbbox(); s=s.crop(bb); sprites.append((n,s))
W=400; x=y=rowh=0; pos={}; sheet=Image.new('RGBA',(W,420),(0,0,0,0))
for n,s in sorted(sprites,key=lambda t:-t[1].height):
    if x+s.width+1>W: x=0; y+=rowh+1; rowh=0
    sheet.alpha_composite(s,(x,y)); pos[n]={'x':x,'y':y,'w':s.width,'h':s.height}; x+=s.width+1; rowh=max(rowh,s.height)
sheet=sheet.crop((0,0,W,y+rowh+1)); sheet.save('assets/props/props.png'); json.dump(pos,open('assets/props/props.json','w'))
print(sheet.size,len(pos),{k:(v['w'],v['h']) for k,v in pos.items() if k in('pine_a','tree_red','rock_m','lamp','bench','lily_1','fl_white','log')})
