import SimpleHTTPServer
import hashlib
import os
from sys import argv

ROOT = "/".join(os.path.abspath(__file__).split("/")[:-2])+"/"
with open(ROOT+'files/kittsha224.txt','r') as pwdf:
	CORRECT_PASSWORD_SHA224 = pwdf.readlines()[0]

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
		IP = int(argv[1])
	if len(argv)>1:
		PORT = int(argv[1])
		IP = ""
	else:
		PORT = 9020
		IP = ""

	KITT = CORSHTTPRequestHandler
	#Handler = SimpleHTTPServer.SimpleHTTPRequestHandler
 
	KARR = SocketServer.TCPServer((IP, PORT), KITT)
 
	print("Serving at port "+str(PORT))
	KARR.serve_forever()