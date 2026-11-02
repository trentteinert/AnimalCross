from PIL import Image
import glob,json
IMG=glob.glob('/private/tmp/claude-501/*/40fa22a6-9c88-4b19-a24d-2de13cb11e81/images/')[0]
PREV='/private/tmp/claude-501/-Users-trentteinert-Library-Application-Support-Claude-scratch-workspaces-f8cc4943-247b-47e9-bc16-1f5a891a44b2-6bc656b8-541c-4c01-bd8a-3ca80e0a02cd-scratch-2026-11-02-271fcf/40fa22a6-9c88-4b19-a24d-2de13cb11e81/scratchpad/sheets/'
im=Image.open(IMG+'11.webp').convert('RGBA'); S=5.875
def native(c,w=None,h=None):
    w=w or max(1,round(c.width/S)); h=h or max(1,round(c.height/S)); out=Image.new('RGBA',(w,h),(0,0,0,0)); px=c.load(); o=out.load()
    for y in range(h):
        for x in range(w):
            sx=min(c.width-1,int((x+.5)*c.width/w)); sy=min(c.height-1,int((y+.5)*c.height/h)); p=px[sx,sy]
            if p[3]>110: o[x,y]=(p[0],p[1],p[2],255)
    return out
rows=[(21,114),(119,214),(220,315),(321,404),(410,496),(498,579)]
pitch=101.58
def tile(r,c): x0=int(21+c*pitch); y0=rows[r][0]; return im.crop((x0+3,y0+3,x0+91,y0+91))  # inset past the rounded corners
fills={'grass':[(0,0),(0,6),(0,1),(0,2)],'dirt':[(0,3),(0,4),(0,5),(0,4)],'sand':[(0,8),(0,9),(0,10),(0,11)],'water':[(3,0),(3,1),(3,2),(3,1)]}
sheet=Image.new('RGBA',(16*4,16*4),(0,0,0,255)); ri=0; pal={}
for name,lst in fills.items():
    for k,(r,c) in enumerate(lst):
        t=native(tile(r,c),16,16); sheet.paste(t,(k*16,ri*16)); 
    ri+=1
sheet.save('assets/tiles/fills.png'); print('fills saved',sheet.size)
# palette sampling: dominant colours of fills + lip colour from the water/grass edge tile
from collections import Counter
def top(img,n=4): c=Counter(img.getdata()); return [(k[:3],v) for k,v in c.most_common(n)]
for ri,(name,lst) in enumerate(fills.items()):
    t=sheet.crop((0,ri*16,16,ri*16+16)); print(name,top(t))
edge=native(im.crop((int(21+3*pitch)+3,321+3,int(21+3*pitch)+91,404-3)),16,16); print('water/grass edge',top(edge,6))
# ---- props: connected components below the terrain block
mask=im.getchannel('A').point(lambda v:255 if v>40 else 0); W,H=im.size; mp=mask.load()
visited=set(); comps=[]
def flood(sx,sy):
    st=[(sx,sy)]; pts=[]; visited.add((sx,sy))
    while st:
        x,y=st.pop(); pts.append((x,y))
        for dx in (-3,0,3):
            for dy in (-3,0,3):
                nx,ny=x+dx,y+dy
                if 0<=nx<W and 0<=ny<H and (nx,ny) not in visited and mp[nx,ny]: visited.add((nx,ny)); st.append((nx,ny))
    return pts
for y in range(585,H,3):
    for x in range(0,W,3):
        if mp[x,y] and (x,y) not in visited:
            pts=flood(x,y)
            if len(pts)>12:
                xs=[p[0] for p in pts]; ys=[p[1] for p in pts]; comps.append((min(xs)-2,min(ys)-2,max(xs)+4,max(ys)+4,len(pts)))
print('components',len(comps))
# group into lines by vertical centre
comps.sort(key=lambda c:(c[1]+c[3])/2)
lines=[]
for c in comps:
    cy=(c[1]+c[3])/2
    for L in lines:
        if abs(L['cy']-cy)<55: L['items'].append(c); L['cy']=sum((i[1]+i[3])/2 for i in L['items'])/len(L['items']); break
    else: lines.append({'cy':cy,'items':[c]})
for L in lines: L['items'].sort(key=lambda c:c[0])
for i,L in enumerate(lines): print('line',i,int(L['cy']),[(c[0],c[1],c[2]-c[0],c[3]-c[1]) for c in L['items']])
json.dump([[list(c) for c in L['items']] for L in lines],open('/tmp/lines.json','w'))
# contact sheet with indices
import PIL.ImageDraw as D
cs=im.copy(); bg=Image.new('RGBA',im.size,(40,40,60,255)); bg.alpha_composite(cs); d=D.Draw(bg)
for li,L in enumerate(lines):
    for ci,c in enumerate(L['items']): d.rectangle((c[0],c[1],c[2],c[3]),outline=(255,255,0,255)); d.text((c[0]+2,c[1]+2),'%d.%d'%(li,ci),fill=(255,255,255,255))
bg.crop((0,585,W,H)).save(PREV+'props_index.png')
