from PIL import Image
import glob,os
IMG=glob.glob('/private/tmp/claude-501/*/40fa22a6-9c88-4b19-a24d-2de13cb11e81/images/')[0]
S=5.875  # source pixels per native pixel
CW,CH=24,40
def runs(m):
    r=[];s=None
    for i,v in enumerate(m):
        if v and s is None:s=i
        if not v and s is not None:r.append((s,i-1));s=None
    if s is not None:r.append((s,len(m)-1))
    return r
def bbox(im,box):
    a=im.getchannel('A').crop(box).point(lambda v:255 if v>40 else 0); return a.getbbox()
def native(im,b):
    c=im.crop(b); w=max(1,round(c.width/S)); h=max(1,round(c.height/S)); out=Image.new('RGBA',(w,h),(0,0,0,0)); px=c.load(); o=out.load()
    for y in range(h):
        for x in range(w):
            sx=min(c.width-1,int((x+.5)*c.width/w)); sy=min(c.height-1,int((y+.5)*c.height/h)); p=px[sx,sy]
            if p[3]>110: o[x,y]=(p[0],p[1],p[2],255)
    return out
def cells(path,cols,rows,colw=None):
    im=Image.open(path).convert('RGBA'); W,H=im.size; a=im.getchannel('A').point(lambda v:255 if v>40 else 0); px=a.load()
    cg=runs([any(px[x,y] for y in range(H)) for x in range(W)]); rg=runs([any(px[x,y] for x in range(W)) for y in range(H)])
    return im,cg,rg
# ---- body
im,cg,rg=cells(IMG+'13.webp',4,8)
body=[[None]*4 for _ in range(8)]
for r,(y0,y1) in enumerate(rg):
    for c,(x0,x1) in enumerate(cg):
        pad=14; box=(max(0,x0-pad),y0-4,x1+pad,y1+4); bb=bbox(im,box)
        b=(box[0]+bb[0],box[1]+bb[1],box[0]+bb[2],box[1]+bb[3]); body[r][c]=(native(im,b),b)
# alignment per row from neutral frame (col 1)
def head_center(spr):
    px=spr.load(); xs=[x for y in range(max(1,spr.height*2//5)) for x in range(spr.width) if px[x,y][3]]
    return sum(xs)/len(xs) if xs else spr.width/2
HDY=[8,5,3,1,1,1,3,5]
sheet=Image.new('RGBA',(CW*4,CH*8),(0,0,0,0)); info={}
for r in range(8):
    n=body[r][1][0]; hc=head_center(n); ox=round(12-hc); oy=CH-2-n.height
    info[r]=(ox,oy,n.width,n.height)
    for c in range(4):
        s=body[r][c][0]; hcc=head_center(s)
        # keep each frame's own horizontal head centre stable but preserve vertical bob via the row's bottom anchor
        x=round(12-hcc)+0; y=oy+ (n.height - s.height)
        sheet.alpha_composite(s,(c*CW+x,r*CH+y))
sheet.save('assets/chars/body.png')
print('body native sizes per row (w,h):',[ (info[r][2],info[r][3]) for r in range(8)])
# ---- layers
im,cg,rg=cells(IMG+'12.webp',12,8)
def layer(name,c0):
    out=Image.new('RGBA',(CW*4,CH*8),(0,0,0,0)); sizes=[]
    for r,(y0,y1) in enumerate(rg):
        for k in range(4):
            x0,x1=cg[c0+k]; pad=10; box=(max(0,x0-pad),max(0,y0-4),x1+pad,y1+4); bb=bbox(im,box)
            if not bb: continue
            b=(box[0]+bb[0],box[1]+bb[1],box[0]+bb[2],box[1]+bb[3]); s=native(im,b); sizes.append((s.width,s.height))
            bw,bh=body[r][k][0].size
            hc=head_center(body[r][k][0]); ox,oy,_,_=info[r]; bodytop=oy+(info[r][3]-bh); bodyx=round(12-hc)
            if name=='hair':   # centred on the head, top at the head top
                x=bodyx+round(hc-s.width/2); y=bodytop-HDY[r]
            elif name=='top':  # centred, starting at the neck
                x=bodyx+round(hc-s.width/2); y=bodytop+round(bh*0.36)
            else:              # pants: centred, ending at the feet
                x=bodyx+round(hc-s.width/2); y=bodytop+bh-s.height
            out.alpha_composite(s,(k*CW+x,r*CH+y))
    out.save('assets/chars/%s.png'%name); print(name,'sizes',sizes[:4])
layer('hair',0); layer('top',4); layer('pants',8)
# preview composite (bodies + pants + top + hair), 6x
prev=Image.new('RGBA',(CW*4,CH*8),(40,60,40,255))
for f in ['body','pants','top','hair']: prev.alpha_composite(Image.open('assets/chars/%s.png'%f))
prev=prev.resize((CW*4*5,CH*8*5),Image.NEAREST); prev.save('/private/tmp/claude-501/-Users-trentteinert-Library-Application-Support-Claude-scratch-workspaces-f8cc4943-247b-47e9-bc16-1f5a891a44b2-6bc656b8-541c-4c01-bd8a-3ca80e0a02cd-scratch-2026-11-02-271fcf/40fa22a6-9c88-4b19-a24d-2de13cb11e81/scratchpad/sheets/char_preview.png')
