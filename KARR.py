import SimpleHTTPServer
import hashlib
import os
from sys import argv

import json
import requests
import pickle
import random


ROOT = "/".join(os.path.abspath(__file__).split("/")[:-2])+"/"
with open(ROOT+'files/kittsha224.txt','r') as pwdf:
	CORRECT_PASSWORD_SHA224 = pwdf.readlines()[0]

with open(ROOT+'files/gglimg.pck') as imgf:
	google_images = pickle.load(imgf)

class CORSHTTPRequestHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
	
	def classifier(self,data="",type='POST'):
		"""
		Does some custom stuff depending on the data that was sent in the body of a POST or GET
		request. Must be a string of METHOD name and (optionally) arguments, separated by '\n'
		"""
		if type=="GET":
			body = self.path[2:].replace("%20"," ").replace("%22",'"').replace("%27","'").split("\n")
		else:
			body = data.split("\n")
		mname = "c_"+body[0]
		if not hasattr(self, mname):
			self.tr_prep()
			print("Trying to access non-existing method.")
			self.wfile.write("Something went wrong. Not my job to find out what and why.")
			return
		else:
			method = getattr(self, mname)
		print("Performing "+mname)
		if len(body)>1:
			method(*body[1:])
		else:
			method()
	
	def do_GET(self):
		"""Serve a GET request."""
		if "/?" in self.path:
			self.classifier(type='GET')
		else:
			f = self.send_head()
			if f:
				self.copyfile(f, self.wfile)
				f.close()
	
	def do_POST(self):
		"""Server a POST request."""
		length = int(self.headers['Content-Length'])
		sock_read = self.rfile.read(length)
		self.classifier(sock_read)
	
	def c_BACKUP(self,password,data):
		"""Backup the received data."""
		if hashlib.sha224(password).hexdigest() != CORRECT_PASSWORD_SHA224: 
			print("INTRUDER! INTRUDER!" + str(self.connection.getpeername()))
			return
		with open(ROOT+'files/backup.txt','w') as f:
			f.seek(0)
			f.write(data)
			f.close()
			self.tr_prep()
			self.wfile.write("Backed everything up successfully!")
			
	def c_RNDPIC(self,local,query):
		"""
		Retrieve a link to a random picture from google image search.
		Also save the results to use in the future for the same query.
		
		resnum		Last requested 'page', which was saved to file to save
					request numbers while still having lots of results.
		links		Array of previously saved links (loaded from file) or an empty
					array to which new results will be concatenated
		endofres	True/False. If True - no more new results for that query, so
					stop even trying and save those precious free requests!
		
		If endofres AND saved links array is empty - bad query, send 'no results'
		and return from function.
		"""
		if query in google_images:
			start = google_images[query]['resnum']
			links = google_images[query]['links']
			endofres = google_images[query]['endofres']
			if len(links) == 0 and endofres:
				self.tr_prep()
				self.wfile.write("No results found.")
				return
		else:
			google_images[query] = {}
			links = []
			start = 0
			endofres = False
		url = 'https://ajax.googleapis.com/ajax/services/search/images?v=1.0&q=' + query + '&start=%d'
		results = []
		if not endofres and not local:
			for i in range(start,start+3):
				r = json.loads(requests.get(url % i).text)
				results += r['responseData']['results']
				if len(results) == 0:
					endofres = True
					break
		if len(results)>0: 
			links += map(self.json_images_links,results)
		self.tr_prep()
		if len(links) > 0:
			ind = random.randint(0,len(links)-1)
			self.wfile.write(links[ind])
		else:
			self.wfile.write("No results found.")
		google_images[query]['resnum'] = start+3
		google_images[query]['links'] = links
		google_images[query]['endofres'] = endofres
		with open(ROOT+'files/gglimg.pck','w') as imgf:
			pickle.dump(google_images,imgf)
	
	def json_images_links(self,element):
		return str(element['unescapedUrl'])
		
	def tr_prep(self,type='text/plain'):
		"""
		Send the OK response and two mandatory headers together with and empty line 
		before the actual data is sent.
		"""
		self.send_response(200)
		self.send_header("Content-type",type)
		self.send_header("Access-Control-Allow-Origin","*")
		self.end_headers()
	
	def send_head(self):
		"""Common code for GET and HEAD commands.

		This sends the response code and MIME headers.

		Return value is either a file object (which has to be copied
		to the output file by the caller unless the command was HEAD,
		and must be closed by the caller under all circumstances), or
		None, in which case the caller has nothing further to do.

		"""
		path = self.translate_path(self.path)
		f = None
		if os.path.isdir(path):
			if not self.path.endswith('/'):
				# redirect browser - doing basically what apache does
				self.send_response(301)
				self.send_header("Location", self.path + "/")
				self.end_headers()
				return None
			for index in "index.html", "index.htm":
				index = os.path.join(path, index)
				if os.path.exists(index):
					path = index
					break
			else:
				return self.list_directory(path)
		ctype = self.guess_type(path)
		try:
			# Always read in binary mode. Opening files in text mode may cause
			# newline translations, making the actual size of the content
			# transmitted *less* than the content-length!
			f = open(path, 'rb')
		except IOError:
			self.send_error(404, "File not found")
			return None
		self.send_response(200)
		self.send_header("Content-type", ctype)
		fs = os.fstat(f.fileno())
		self.send_header("Content-Length", str(fs[6]))
		self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
		self.send_header("Access-Control-Allow-Origin", "*")
		self.end_headers()
		return f

if __name__ == "__main__":
	import os
	import SocketServer

	if len(argv)>2:
		PORT = int(argv[2])
		IP = argv[1]
	elif len(argv)>1:
		PORT = int(argv[1])
		IP = ""
	else:
		PORT = 9020
		IP = ""

	Handler = CORSHTTPRequestHandler
	#Handler = SimpleHTTPServer.SimpleHTTPRequestHandler
 
	KARR = SocketServer.TCPServer((IP, PORT), Handler)
 
	print("Serving at port "+str(PORT))
	KARR.serve_forever()